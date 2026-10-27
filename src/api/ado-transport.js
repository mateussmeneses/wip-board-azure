// src/api/ado-transport.js
// Injectable HTTP transport for the Azure DevOps read-only client (T2.1).
//
// Purpose
// -------
// A thin, testable wrapper around `fetch` that:
//   - accepts an INJECTED fetch (tests pass a mock; no live network in tests),
//   - enforces the READ-ONLY method policy (only GET and the WIQL POST),
//   - attaches auth via the injected auth provider (no token is ever logged),
//   - applies a timeout via AbortController,
//   - classifies every outcome through ado-errors into a typed AdoApiError,
//   - retries ONLY transient failures (429/5xx/network/timeout) with bounded,
//     jittered exponential backoff — never infinitely, never for 401/403/404.
//
// This layer holds NO business rules (no sprint/iteration/column logic). It only
// moves bytes and classifies failures, so the query modules stay pure and the
// transport stays trivially mockable.
//
// Security (goal section 5):
// - The method allow-list is enforced here as a second barrier even though the
//   URL builder already restricts it: a mutating method is rejected with a
//   DISALLOWED error before any request leaves.
// - Authorization/credentials are never written to any log. The transport logs
//   nothing by default; a caller-supplied logger receives only the safe error
//   projection (category/status), never headers or bodies.
//
// Dual environment support:
// - Node test runner: module.exports (CommonJS).
// - Chrome runtime: attaches to window.WIPBoardAdoTransport.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory(
    typeof require === 'function' ? require('./ado-errors.js') : (root && root.WIPBoardAdoErrors)
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoTransport = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Errors) {
  'use strict';

  const { ErrorCategory, AdoApiError } = Errors;

  // Methods the transport is allowed to send. POST is permitted ONLY for the
  // WIQL query endpoint; the URL builder is the authority on which POSTs exist,
  // and the client passes a guarded flag per request.
  const READ_METHODS = Object.freeze(['GET']);

  const DEFAULT_OPTIONS = Object.freeze({
    timeoutMs: 15000,
    maxRetries: 3,          // total attempts = 1 + maxRetries, bounded
    baseDelayMs: 300,       // first backoff step
    maxDelayMs: 5000,       // backoff is capped so it never grows unbounded
  });

  // Create a transport bound to an injected fetch, auth provider and options.
  //   config.fetch        : (url, init) => Promise<Response-like>   (required)
  //   config.authProvider : { isAvailable, decorate }               (required)
  //   config.now          : () => number (ms)   (optional; test clock)
  //   config.sleep        : (ms) => Promise     (optional; test scheduler)
  //   config.random       : () => number [0,1)  (optional; deterministic jitter)
  //   config.logger       : (safeObject) => void (optional; receives SAFE data)
  function createTransport(config) {
    const cfg = config || {};
    const doFetch = cfg.fetch;
    if (typeof doFetch !== 'function') {
      throw new TypeError('ado-transport requires an injected fetch function');
    }
    const authProvider = cfg.authProvider;
    const options = Object.assign({}, DEFAULT_OPTIONS, cfg.options || {});
    const sleep = typeof cfg.sleep === 'function'
      ? cfg.sleep
      : function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
    const random = typeof cfg.random === 'function' ? cfg.random : Math.random;
    const logger = typeof cfg.logger === 'function' ? cfg.logger : null;

    // Compute the backoff delay for a given 0-based retry index, honoring a
    // server Retry-After (seconds) when present. Jitter avoids thundering herds.
    // The delay is always capped by maxDelayMs so backoff never grows unbounded.
    function backoffDelay(retryIndex, retryAfterSeconds) {
      if (typeof retryAfterSeconds === 'number' && retryAfterSeconds >= 0) {
        return Math.min(retryAfterSeconds * 1000, options.maxDelayMs);
      }
      const exponential = options.baseDelayMs * Math.pow(2, retryIndex);
      const capped = Math.min(exponential, options.maxDelayMs);
      // Full jitter in [0.9*capped, 1.1*capped]: subtract half the jitter band
      // and add a random portion of it, keeping the value close to `capped`.
      const jitterBand = capped * 0.2;
      return Math.round(capped - jitterBand / 2 + jitterBand * random());
    }

    function parseRetryAfter(response) {
      if (!response || !response.headers || typeof response.headers.get !== 'function') {
        return null;
      }
      const raw = response.headers.get('Retry-After');
      if (!raw) return null;
      const asNumber = Number(raw);
      if (!Number.isNaN(asNumber)) return asNumber; // delta-seconds form
      const asDate = Date.parse(raw); // HTTP-date form
      if (!Number.isNaN(asDate)) {
        const deltaMs = asDate - Date.now();
        return deltaMs > 0 ? Math.ceil(deltaMs / 1000) : 0;
      }
      return null;
    }

    function logSafe(err) {
      if (logger && err && typeof err.toSafeObject === 'function') {
        try { logger(err.toSafeObject()); } catch (e) { /* logging must never throw */ }
      }
    }

    // Read the response body as JSON, classifying a parse failure as MALFORMED.
    function readJson(response) {
      return Promise.resolve()
        .then(function () { return response.json(); })
        .then(function (data) { return data; })
        .catch(function () {
          throw Errors.malformed('response body was not valid JSON');
        });
    }

    // Perform a single attempt. Resolves with parsed JSON on success; rejects
    // with an AdoApiError otherwise.
    function attempt(request) {
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      let timedOut = false;
      let timer = null;
      if (controller) {
        timer = setTimeout(function () {
          timedOut = true;
          controller.abort();
        }, options.timeoutMs);
      }

      const baseInit = {
        method: request.method,
        headers: Object.assign({ Accept: 'application/json' }, request.headers || {}),
      };
      if (request.body !== undefined) {
        baseInit.body = request.body;
        baseInit.headers['Content-Type'] = 'application/json';
      }
      if (controller) baseInit.signal = controller.signal;

      return Promise.resolve()
        .then(function () {
          // Auth decoration may be async. It never returns a token to log.
          return authProvider && typeof authProvider.decorate === 'function'
            ? authProvider.decorate(baseInit)
            : baseInit;
        })
        .then(function (init) {
          return doFetch(request.url, init);
        })
        .then(function (response) {
          if (timer) clearTimeout(timer);
          if (!response || typeof response.status !== 'number') {
            throw Errors.malformed('transport received a response without a status');
          }
          if (response.ok) {
            return readJson(response);
          }
          const retryAfterSeconds = parseRetryAfter(response);
          throw Errors.fromStatus(response.status, { retryAfterSeconds: retryAfterSeconds });
        })
        .catch(function (err) {
          if (timer) clearTimeout(timer);
          // An AdoApiError (from status/malformed) passes through unchanged.
          if (err instanceof AdoApiError) throw err;
          // A thrown fetch error: abort => TIMEOUT, else NETWORK/CORS.
          throw Errors.fromThrown(err, { aborted: timedOut });
        });
    }

    // Public send: enforce method policy, then attempt with bounded retry.
    //   request = { method, url, headers?, body?, allowWiqlPost? }
    function send(request) {
      return Promise.resolve().then(function () {
        if (!request || typeof request !== 'object') {
          return Promise.reject(Errors.disallowed('a request object is required'));
        }
        const method = String(request.method || '').toUpperCase();
        const isAllowed =
          READ_METHODS.indexOf(method) !== -1 ||
          (method === 'POST' && request.allowWiqlPost === true);
        if (!isAllowed) {
          // Structural read-only guarantee: reject any write before it leaves.
          return Promise.reject(
            Errors.disallowed('method not permitted by read-only policy: ' + method)
          );
        }
        return runWithRetry(Object.assign({}, request, { method: method }), 0);
      });
    }

    function runWithRetry(request, retryIndex) {
      return attempt(request).catch(function (err) {
        logSafe(err);
        const canRetry = err && err.retryable === true && retryIndex < options.maxRetries;
        if (!canRetry) throw err;
        const delay = backoffDelay(retryIndex, err.retryAfterSeconds);
        return sleep(delay).then(function () {
          return runWithRetry(request, retryIndex + 1);
        });
      });
    }

    return {
      send: send,
      options: options,
      // exported for focused tests
      _backoffDelay: backoffDelay,
      _parseRetryAfter: parseRetryAfter,
    };
  }

  return {
    READ_METHODS: READ_METHODS,
    DEFAULT_OPTIONS: DEFAULT_OPTIONS,
    createTransport: createTransport,
  };
});
