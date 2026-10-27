// src/api/ado-url.js
// Azure DevOps URL builder & validator (PRODUCT_ROADMAP T2.1).
//
// Purpose
// -------
// Build and validate Azure DevOps REST API URLs for READ-ONLY operations only.
// This is the single place that decides which host, which path shape and which
// HTTP method is allowed to leave the extension. Nothing else in the API layer
// is permitted to assemble a URL from raw strings.
//
// Security design (goal section 5):
// - Allow-list of hosts (dev.azure.com, *.visualstudio.com). An arbitrary host
//   is rejected, so a poisoned org/project value cannot redirect a request to a
//   third-party endpoint.
// - Every path segment is validated and encoded, so a segment cannot smuggle a
//   "../" traversal, a protocol, a query string or a second host.
// - A fixed api-version is appended; callers never choose it.
// - Only GET and the WIQL-query POST are expressible here. No builder produces a
//   create/update/delete URL, so the read-only policy is structural, not a
//   convention someone can forget.
//
// This module is PURE: no network, no Chrome, no DOM. It is consumed by the
// transport and the query modules, and unit-tested in isolation.
//
// Dual environment support (same pattern as the sibling data modules):
// - Node test runner: consumed via module.exports (CommonJS).
// - Chrome content script / popup: attaches to window.WIPBoardAdoUrl.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoUrl = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The only REST api-version this client speaks. Centralized so a bump is a
  // one-line change and no caller can request an unexpected version.
  const API_VERSION = '7.1';

  // Allow-listed hosts for Azure DevOps Services. `dev.azure.com` is the modern
  // host; `*.visualstudio.com` is the legacy per-org host still in use. These
  // mirror the manifest host_permissions; nothing else is reachable.
  const ALLOWED_HOSTS = Object.freeze([
    'dev.azure.com',
    'visualstudio.com', // matched as a suffix for <org>.visualstudio.com
  ]);

  const ErrorCodes = Object.freeze({
    INVALID_HOST: 'INVALID_HOST',
    INVALID_SEGMENT: 'INVALID_SEGMENT',
    INVALID_BASE: 'INVALID_BASE',
    DISALLOWED_METHOD: 'DISALLOWED_METHOD',
  });

  class AdoUrlError extends Error {
    constructor(code, message) {
      super(message || code);
      this.name = 'AdoUrlError';
      this.code = code;
    }
  }

  // A path segment must be a non-empty string with no slashes, backslashes,
  // relative-path markers, protocol markers or query/fragment characters. This
  // blocks traversal ("..", "/", "\"), host injection ("//evil.com") and query
  // smuggling ("x?api-version=...&destroy=1").
  function assertSafeSegment(value, label) {
    const s = value == null ? '' : String(value);
    if (s.trim() === '') {
      throw new AdoUrlError(ErrorCodes.INVALID_SEGMENT, (label || 'segment') + ' is required');
    }
    if (/[\/\\]/.test(s)) {
      throw new AdoUrlError(ErrorCodes.INVALID_SEGMENT, (label || 'segment') + ' must not contain a slash');
    }
    if (s === '.' || s === '..') {
      throw new AdoUrlError(ErrorCodes.INVALID_SEGMENT, (label || 'segment') + ' must not be a relative marker');
    }
    if (/[?#]/.test(s)) {
      throw new AdoUrlError(ErrorCodes.INVALID_SEGMENT, (label || 'segment') + ' must not contain a query/fragment');
    }
    if (/[\x00-\x1f]/.test(s)) {
      throw new AdoUrlError(ErrorCodes.INVALID_SEGMENT, (label || 'segment') + ' must not contain control chars');
    }
    return s;
  }

  // Validate a base origin ("https://dev.azure.com" or
  // "https://contoso.visualstudio.com"). HTTPS only; host must be allow-listed.
  function assertAllowedBase(base) {
    let url;
    try {
      url = new URL(base);
    } catch (e) {
      throw new AdoUrlError(ErrorCodes.INVALID_BASE, 'base is not a valid absolute URL');
    }
    if (url.protocol !== 'https:') {
      throw new AdoUrlError(ErrorCodes.INVALID_BASE, 'base must be https');
    }
    if (!isAllowedHost(url.hostname)) {
      throw new AdoUrlError(ErrorCodes.INVALID_HOST, 'host is not allow-listed: ' + url.hostname);
    }
    // Normalize to origin only (strip any path/query a caller may have passed).
    return url.origin;
  }

  function isAllowedHost(hostname) {
    const host = String(hostname || '').toLowerCase();
    return ALLOWED_HOSTS.some(function (allowed) {
      if (allowed === 'visualstudio.com') {
        // legacy per-org host: exactly visualstudio.com or *.visualstudio.com
        return host === allowed || host.endsWith('.' + allowed);
      }
      return host === allowed;
    });
  }

  // Encode each already-validated segment for safe inclusion in a path.
  function encodeSegments(segments) {
    return segments
      .map(function (s) {
        return encodeURIComponent(s);
      })
      .join('/');
  }

  // Merge the fixed api-version with caller query params. Caller params are
  // validated to be primitive scalars; api-version is forced and cannot be
  // overridden by a caller key.
  function buildQuery(params) {
    const usp = new URLSearchParams();
    if (params && typeof params === 'object') {
      Object.keys(params).forEach(function (key) {
        if (key === 'api-version') return; // never let a caller override it
        const value = params[key];
        if (value == null) return;
        if (typeof value === 'object') return; // only scalars in a query
        usp.set(key, String(value));
      });
    }
    usp.set('api-version', API_VERSION);
    return usp.toString();
  }

  // Build a validated absolute URL from a base, path segments and query params.
  // segments: array of raw (unencoded) strings, each checked by assertSafeSegment.
  function buildUrl(base, segments, params) {
    const origin = assertAllowedBase(base);
    const safe = (segments || []).map(function (seg, i) {
      return assertSafeSegment(seg, 'segment[' + i + ']');
    });
    const path = encodeSegments(safe);
    const query = buildQuery(params);
    return origin + '/' + path + '?' + query;
  }

  // Resolve the API base origin for a scope. Prefers an explicit organizationUrl
  // (e.g. "https://dev.azure.com/sda-iatec" or a visualstudio.com org URL). When
  // only an organization name is supplied, defaults to the modern dev.azure.com
  // host. The returned base is the ORIGIN only; the org is a separate segment.
  function resolveBase(scope) {
    if (scope && scope.organizationUrl) {
      return assertAllowedBase(scope.organizationUrl);
    }
    // Default modern host. The org name becomes the first path segment.
    return 'https://dev.azure.com';
  }

  // ---- Read-only endpoint builders ------------------------------------------
  // Each builder validates its inputs and returns { method, url }. The method is
  // fixed per endpoint; a builder NEVER emits a mutating method.

  // GET iterations for a team.
  function iterations(scope) {
    const base = resolveBase(scope);
    const url = buildUrl(base, [
      scope.organization,
      scope.project,
      scope.team,
      '_apis', 'work', 'teamsettings', 'iterations',
    ]);
    return { method: 'GET', url: url };
  }

  // GET the work item ids of a single iteration.
  function iterationWorkItems(scope, iterationId) {
    assertSafeSegment(iterationId, 'iterationId');
    const base = resolveBase(scope);
    const url = buildUrl(base, [
      scope.organization,
      scope.project,
      scope.team,
      '_apis', 'work', 'teamsettings', 'iterations', iterationId, 'workitems',
    ]);
    return { method: 'GET', url: url };
  }

  // GET a batch of work items by id, selecting only the required fields.
  // ids: number[] (<= 200 enforced by the caller/query module, not here).
  function workItems(scope, ids, fields) {
    const base = resolveBase(scope);
    const idList = (ids || []).map(function (id) { return String(id); }).join(',');
    const params = { ids: idList };
    if (Array.isArray(fields) && fields.length) {
      params.fields = fields.join(',');
      // When selecting explicit fields, $expand must not be combined; omit it.
    }
    const url = buildUrl(base, [
      scope.organization,
      scope.project,
      '_apis', 'wit', 'workitems',
    ], params);
    return { method: 'GET', url: url };
  }

  // GET the board columns for a team's board.
  function boardColumns(scope, board) {
    assertSafeSegment(board, 'board');
    const base = resolveBase(scope);
    const url = buildUrl(base, [
      scope.organization,
      scope.project,
      scope.team,
      '_apis', 'work', 'boards', board, 'columns',
    ]);
    return { method: 'GET', url: url };
  }

  // POST a WIQL query. This is the ONLY POST the client can build. It is a READ
  // (query) operation; it never creates, updates or deletes a work item. The
  // caller supplies a WIQL string; the body is assembled by the query module.
  function wiql(scope) {
    const base = resolveBase(scope);
    const url = buildUrl(base, [
      scope.organization,
      scope.project,
      '_apis', 'wit', 'wiql',
    ]);
    return { method: 'POST', url: url };
  }

  return {
    API_VERSION: API_VERSION,
    ALLOWED_HOSTS: ALLOWED_HOSTS,
    ErrorCodes: ErrorCodes,
    AdoUrlError: AdoUrlError,
    // primitives (exported for focused tests)
    assertSafeSegment: assertSafeSegment,
    assertAllowedBase: assertAllowedBase,
    isAllowedHost: isAllowedHost,
    buildUrl: buildUrl,
    buildQuery: buildQuery,
    resolveBase: resolveBase,
    // endpoint builders
    iterations: iterations,
    iterationWorkItems: iterationWorkItems,
    workItems: workItems,
    boardColumns: boardColumns,
    wiql: wiql,
  };
});
