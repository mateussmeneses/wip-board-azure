// src/api/ado-client.js
// Azure DevOps read-only API client — composition root (PRODUCT_ROADMAP T2.1).
//
// Purpose
// -------
// Wire the small single-responsibility modules into ONE read-only client:
//   - ado-feature-flag : gate every call (OFF by default)
//   - ado-auth         : injectable auth provider (no stored credential)
//   - ado-transport    : injectable fetch, retry/backoff, read-only method policy
//   - ado-url          : host-allow-listed, traversal-safe endpoint builders
//   - ado-contracts    : normalize raw REST payloads into stable shapes
//   - ado-errors       : one typed error model
//
// This client exposes the READ queries the Sprint/Roadmap features will need:
//   getIterations, getCurrentIteration, getIterationWorkItemIds,
//   getWorkItems (batched, <=200 per request), getBoardColumns, queryWiql.
//
// It holds the ORCHESTRATION (batching, dedupe, current-iteration selection) but
// no deeper sprint business logic — that belongs to the feature layer (T2.2+).
//
// Safety guarantees enforced here:
//   - With the flag OFF (default) OR no available auth, EVERY method rejects with
//     a DISALLOWED error and NO fetch is issued (so the DOM runtime is untouched
//     and no auth error can reach the WIP indicator). Callers treat DISALLOWED as
//     "API not available, fall back to DOM".
//   - Only read endpoints exist; the single POST (WIQL) is a query and is routed
//     with an explicit allowWiqlPost flag. No create/update/delete method exists.
//   - Scope is validated; org/project/team/board come from caller input, never
//     from an arbitrary URL.
//
// Dual environment support:
// - Node test runner: module.exports (CommonJS).
// - Chrome runtime: attaches to window.WIPBoardAdoClient.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const isNode = typeof require === 'function';
  const deps = {
    url: isNode ? require('./ado-url.js') : (root && root.WIPBoardAdoUrl),
    errors: isNode ? require('./ado-errors.js') : (root && root.WIPBoardAdoErrors),
    contracts: isNode ? require('./ado-contracts.js') : (root && root.WIPBoardAdoContracts),
    transport: isNode ? require('./ado-transport.js') : (root && root.WIPBoardAdoTransport),
    auth: isNode ? require('./ado-auth.js') : (root && root.WIPBoardAdoAuth),
    flag: isNode ? require('./ado-feature-flag.js') : (root && root.WIPBoardAdoFeatureFlag),
  };
  const api = factory(deps);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoClient = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (deps) {
  'use strict';

  const Url = deps.url;
  const Errors = deps.errors;
  const Contracts = deps.contracts;
  const Transport = deps.transport;
  const Auth = deps.auth;
  const Flag = deps.flag;

  // The REST batch endpoint caps at 200 ids per call; we chunk larger sets.
  const MAX_WORKITEMS_PER_REQUEST = 200;

  const Endpoints = Object.freeze([
    'iterations',
    'iterationWorkItems',
    'workItems',
    'boardColumns',
    'wiql',
  ]);

  function assertScope(scope) {
    if (!scope || typeof scope !== 'object') {
      throw new Errors.AdoApiError({
        category: Errors.ErrorCategory.DISALLOWED,
        message: 'scope is required',
      });
    }
    ['organization', 'project', 'team'].forEach(function (field) {
      if (scope[field] == null || String(scope[field]).trim() === '') {
        throw new Errors.AdoApiError({
          category: Errors.ErrorCategory.DISALLOWED,
          message: 'scope.' + field + ' is required',
        });
      }
    });
    return scope;
  }

  // Split an id array into chunks of at most `size`, after de-duplicating while
  // preserving first-seen order (duplicate ids must not inflate a batch).
  function chunkIds(ids, size) {
    const seen = new Set();
    const unique = [];
    (ids || []).forEach(function (id) {
      if (id == null) return;
      if (seen.has(id)) return;
      seen.add(id);
      unique.push(id);
    });
    const chunks = [];
    for (let i = 0; i < unique.length; i += size) {
      chunks.push(unique.slice(i, i + size));
    }
    return chunks;
  }

  // Create a client. `config`:
  //   fetch        : injected fetch (required)
  //   authProvider : injected provider (default: session cookie provider)
  //   storage      : chrome.storage.sync adapter for the flag (injectable)
  //   options      : transport options (timeout/retry)
  //   now/sleep/random/logger : passed to the transport (test seams)
  function createClient(config) {
    const cfg = config || {};
    const authProvider = cfg.authProvider || Auth.sessionCookieProvider();
    // Validate the provider up front; an invalid provider means "no auth".
    let validProvider = null;
    try {
      validProvider = Auth.assertProvider(authProvider);
    } catch (e) {
      validProvider = Auth.nullProvider();
    }

    const transport = Transport.createTransport({
      fetch: cfg.fetch,
      authProvider: validProvider,
      options: cfg.options,
      now: cfg.now,
      sleep: cfg.sleep,
      random: cfg.random,
      logger: cfg.logger,
    });

    // The gate: resolves true only when the flag is ON and auth is available.
    function gate() {
      return Flag.canMakeRequests({
        storage: cfg.storage,
        authProvider: validProvider,
      });
    }

    // Run `fn` only when the gate allows it; otherwise reject with DISALLOWED so
    // the caller falls back to DOM without surfacing an auth error.
    function guarded(fn) {
      return gate().then(function (allowed) {
        if (!allowed) {
          throw new Errors.AdoApiError({
            category: Errors.ErrorCategory.DISALLOWED,
            message: 'Azure API is disabled or unauthenticated; no request issued',
          });
        }
        return fn();
      });
    }

    // --- iterations ----------------------------------------------------------

    function getIterations(scope) {
      return guarded(function () {
        assertScope(scope);
        const req = Url.iterations(scope);
        return transport.send(req).then(function (payload) {
          return Contracts.normalizeIterations(payload);
        });
      });
    }

    function getCurrentIteration(scope) {
      return getIterations(scope).then(function (iterations) {
        // null when the team has no active sprint — never guessed.
        return Contracts.selectCurrentIteration(iterations);
      });
    }

    function getIterationWorkItemIds(scope, iterationId) {
      return guarded(function () {
        assertScope(scope);
        if (iterationId == null || String(iterationId).trim() === '') {
          throw new Errors.AdoApiError({
            category: Errors.ErrorCategory.DISALLOWED,
            message: 'iterationId is required',
          });
        }
        const req = Url.iterationWorkItems(scope, String(iterationId));
        return transport.send(req).then(function (payload) {
          return Contracts.normalizeIterationWorkItemIds(payload);
        });
      });
    }

    // --- work items (batched) ------------------------------------------------

    // Fetch work items by id. De-dupes and splits into <=200-id batches, then
    // normalizes and concatenates. Returns normalized WorkItem[] in id order of
    // first appearance. An empty id list resolves to [] WITHOUT any request.
    function getWorkItems(scope, ids, fields) {
      return guarded(function () {
        assertScope(scope);
        const batches = chunkIds(ids, MAX_WORKITEMS_PER_REQUEST);
        if (batches.length === 0) return [];
        const selectFields = Array.isArray(fields) && fields.length
          ? fields
          : Contracts.DEFAULT_WORKITEM_FIELDS;

        // Run batches sequentially to stay gentle on rate limits; a 429 in one
        // batch is retried by the transport, not by firing all batches at once.
        return batches.reduce(function (acc, batch) {
          return acc.then(function (collected) {
            const req = Url.workItems(scope, batch, selectFields);
            return transport.send(req).then(function (payload) {
              const list = payload && Array.isArray(payload.value) ? payload.value : [];
              const normalized = list.map(Contracts.normalizeWorkItem).filter(Boolean);
              return collected.concat(normalized);
            });
          });
        }, Promise.resolve([]));
      });
    }

    // --- board columns -------------------------------------------------------

    function getBoardColumns(scope, board) {
      return guarded(function () {
        assertScope(scope);
        const boardRef = board != null ? board : scope.board;
        if (boardRef == null || String(boardRef).trim() === '') {
          throw new Errors.AdoApiError({
            category: Errors.ErrorCategory.DISALLOWED,
            message: 'board is required',
          });
        }
        const req = Url.boardColumns(scope, String(boardRef));
        return transport.send(req).then(function (payload) {
          return Contracts.normalizeBoardColumns(payload);
        });
      });
    }

    // --- WIQL (read-only query) ----------------------------------------------

    // Run a WIQL query and return the raw work item ids it resolved. This is a
    // READ operation; the body carries only a query string. The POST is routed
    // with allowWiqlPost=true, the ONLY POST the transport will send.
    function queryWiql(scope, wiql) {
      return guarded(function () {
        assertScope(scope);
        if (typeof wiql !== 'string' || wiql.trim() === '') {
          throw new Errors.AdoApiError({
            category: Errors.ErrorCategory.DISALLOWED,
            message: 'a WIQL query string is required',
          });
        }
        const req = Url.wiql(scope);
        return transport
          .send({
            method: req.method, // 'POST'
            url: req.url,
            body: JSON.stringify({ query: wiql }),
            allowWiqlPost: true,
          })
          .then(function (payload) {
            const rows = payload && Array.isArray(payload.workItems) ? payload.workItems : [];
            const seen = new Set();
            const ids = [];
            rows.forEach(function (row) {
              if (!row || row.id == null) return;
              if (seen.has(row.id)) return;
              seen.add(row.id);
              ids.push(row.id);
            });
            return ids;
          });
      });
    }

    // --- capability (diagnostics) --------------------------------------------

    // Report what the client can do right now WITHOUT issuing a request that
    // mutates anything. Proven-vs-mocked honesty: liveAccessProven is only true
    // when a caller explicitly records a verified live spike.
    function describeCapability(extra) {
      return Flag.isEnabled(cfg.storage).then(function (enabled) {
        return Promise.resolve()
          .then(function () { return validProvider.isAvailable(); })
          .then(function (available) {
          const described = typeof validProvider.describe === 'function'
            ? validProvider.describe()
            : { strategy: null };
          return Contracts.buildCapability(Object.assign({
            featureFlagEnabled: enabled === true,
            authStrategy: described.strategy,
            authAvailable: available === true,
            endpointsImplemented: Endpoints.slice(),
            liveAccessProven: false,
            notes: described.notes || '',
          }, extra || {}));
        });
      });
    }

    return {
      getIterations: getIterations,
      getCurrentIteration: getCurrentIteration,
      getIterationWorkItemIds: getIterationWorkItemIds,
      getWorkItems: getWorkItems,
      getBoardColumns: getBoardColumns,
      queryWiql: queryWiql,
      describeCapability: describeCapability,
      // exported for focused tests
      _chunkIds: chunkIds,
      _gate: gate,
    };
  }

  return {
    MAX_WORKITEMS_PER_REQUEST: MAX_WORKITEMS_PER_REQUEST,
    Endpoints: Endpoints,
    createClient: createClient,
    // re-export building blocks so a consumer imports one module
    url: Url,
    errors: Errors,
    contracts: Contracts,
    transport: Transport,
    auth: Auth,
    flag: Flag,
    chunkIds: chunkIds,
  };
});
