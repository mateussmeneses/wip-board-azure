// src/api/ado-errors.js
// Structured error model for the Azure DevOps read-only client (T2.1).
//
// Purpose
// -------
// Turn the many failure shapes of an HTTP call (status codes, network errors,
// CORS, timeout, malformed body) into ONE normalized, typed result the feature
// layer can branch on without string matching. Every error carries:
//   - category : a stable machine code (see ErrorCategory)
//   - status   : the HTTP status when there was a response, else null
//   - retryable : whether a limited retry/backoff is appropriate
//   - message  : a short, SAFE message (never contains Authorization headers,
//                tokens or credentials — security requirement)
//
// This module is PURE: no network, no Chrome. It is the single classifier used
// by the transport so classification is consistent and unit-testable.
//
// Dual environment support:
// - Node test runner: module.exports (CommonJS).
// - Chrome runtime: attaches to window.WIPBoardAdoErrors.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoErrors = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Stable categories the feature layer can switch on. These are intentionally
  // coarse and behavior-oriented (what should the caller DO) rather than a 1:1
  // map of every HTTP status.
  const ErrorCategory = Object.freeze({
    UNAUTHORIZED: 'UNAUTHORIZED',      // 401 — no/invalid auth; do NOT retry blindly
    FORBIDDEN: 'FORBIDDEN',            // 403 — authenticated but insufficient rights
    NOT_FOUND: 'NOT_FOUND',            // 404 — resource/scope does not exist
    RATE_LIMITED: 'RATE_LIMITED',      // 429 — back off and retry (bounded)
    SERVER_ERROR: 'SERVER_ERROR',      // 5xx — transient server fault; bounded retry
    NETWORK: 'NETWORK',                // fetch rejected (offline, DNS, reset)
    CORS: 'CORS',                      // blocked by the browser's cross-origin policy
    TIMEOUT: 'TIMEOUT',                // abort fired before a response
    MALFORMED: 'MALFORMED',            // 2xx but body was not the expected JSON shape
    CLIENT_ERROR: 'CLIENT_ERROR',      // other 4xx (400/405/...) — not retryable
    DISALLOWED: 'DISALLOWED',          // request violated the read-only/host policy
    UNKNOWN: 'UNKNOWN',                // anything we could not classify
  });

  // Which categories are safe to retry with backoff. 401/403/404 and policy
  // violations are NEVER retried (retrying an auth/permission failure just burns
  // quota and can trigger lockouts). Only genuinely transient faults are.
  const RETRYABLE = Object.freeze({
    [ErrorCategory.RATE_LIMITED]: true,
    [ErrorCategory.SERVER_ERROR]: true,
    [ErrorCategory.NETWORK]: true,
    [ErrorCategory.TIMEOUT]: true,
  });

  class AdoApiError extends Error {
    constructor(details) {
      const d = details || {};
      super(d.message || d.category || 'AdoApiError');
      this.name = 'AdoApiError';
      this.category = d.category || ErrorCategory.UNKNOWN;
      this.status = typeof d.status === 'number' ? d.status : null;
      this.retryable = d.retryable === true;
      // Optional seconds to wait before a retry, parsed from Retry-After.
      this.retryAfterSeconds = typeof d.retryAfterSeconds === 'number' ? d.retryAfterSeconds : null;
    }

    // A JSON-safe, credential-free projection for logging/telemetry.
    toSafeObject() {
      return {
        category: this.category,
        status: this.status,
        retryable: this.retryable,
        retryAfterSeconds: this.retryAfterSeconds,
        message: this.message,
      };
    }
  }

  // Map an HTTP status to a category. Unknown 4xx -> CLIENT_ERROR (not retryable);
  // unknown 5xx -> SERVER_ERROR (retryable).
  function categoryForStatus(status) {
    switch (status) {
      case 401:
        return ErrorCategory.UNAUTHORIZED;
      case 403:
        return ErrorCategory.FORBIDDEN;
      case 404:
        return ErrorCategory.NOT_FOUND;
      case 429:
        return ErrorCategory.RATE_LIMITED;
      default:
        break;
    }
    if (status >= 500 && status <= 599) return ErrorCategory.SERVER_ERROR;
    if (status >= 400 && status <= 499) return ErrorCategory.CLIENT_ERROR;
    return ErrorCategory.UNKNOWN;
  }

  // Build an AdoApiError from a response status. `retryAfterSeconds` is optional
  // (parsed from the Retry-After header by the transport).
  function fromStatus(status, options) {
    const opts = options || {};
    const category = categoryForStatus(status);
    return new AdoApiError({
      category: category,
      status: status,
      retryable: RETRYABLE[category] === true,
      retryAfterSeconds: typeof opts.retryAfterSeconds === 'number' ? opts.retryAfterSeconds : null,
      message: opts.message || defaultMessageFor(category, status),
    });
  }

  // Classify a thrown fetch error. The browser does not expose a reliable CORS
  // signal; a genuine CORS block and some network failures both surface as a
  // TypeError with a "Failed to fetch"-style message. We classify by the hint
  // the caller passes (e.g. an AbortError => TIMEOUT) and otherwise NETWORK,
  // flagging a possible CORS cause in the message without asserting it falsely.
  function fromThrown(err, options) {
    const opts = options || {};
    if (opts.aborted === true || (err && err.name === 'AbortError')) {
      return new AdoApiError({
        category: ErrorCategory.TIMEOUT,
        status: null,
        retryable: true,
        message: 'request timed out',
      });
    }
    // A TypeError from fetch covers offline, DNS, connection reset AND an opaque
    // CORS rejection. We report NETWORK (retryable) but keep an honest note that
    // CORS is a possible cause, rather than fabricating a definitive CORS verdict.
    const isTypeError = err && (err.name === 'TypeError');
    return new AdoApiError({
      category: isTypeError ? ErrorCategory.NETWORK : ErrorCategory.UNKNOWN,
      status: null,
      retryable: isTypeError, // network failures are worth a bounded retry
      message: isTypeError
        ? 'network request failed (offline, DNS, reset or CORS)'
        : 'unexpected request error',
    });
  }

  function malformed(message) {
    return new AdoApiError({
      category: ErrorCategory.MALFORMED,
      status: null,
      retryable: false,
      message: message || 'response body was not the expected shape',
    });
  }

  function disallowed(message) {
    return new AdoApiError({
      category: ErrorCategory.DISALLOWED,
      status: null,
      retryable: false,
      message: message || 'request violated the read-only/host policy',
    });
  }

  function cors(message) {
    return new AdoApiError({
      category: ErrorCategory.CORS,
      status: null,
      retryable: false,
      message: message || 'request blocked by cross-origin policy',
    });
  }

  function defaultMessageFor(category, status) {
    switch (category) {
      case ErrorCategory.UNAUTHORIZED:
        return 'not signed in or session expired (401)';
      case ErrorCategory.FORBIDDEN:
        return 'insufficient permissions for this resource (403)';
      case ErrorCategory.NOT_FOUND:
        return 'resource or scope not found (404)';
      case ErrorCategory.RATE_LIMITED:
        return 'rate limited by the server (429)';
      case ErrorCategory.SERVER_ERROR:
        return 'server error (' + status + ')';
      case ErrorCategory.CLIENT_ERROR:
        return 'request rejected (' + status + ')';
      default:
        return 'request failed (' + status + ')';
    }
  }

  function isRetryable(error) {
    return !!(error && error.retryable === true);
  }

  return {
    ErrorCategory: ErrorCategory,
    RETRYABLE: RETRYABLE,
    AdoApiError: AdoApiError,
    categoryForStatus: categoryForStatus,
    fromStatus: fromStatus,
    fromThrown: fromThrown,
    malformed: malformed,
    disallowed: disallowed,
    cors: cors,
    isRetryable: isRetryable,
  };
});
