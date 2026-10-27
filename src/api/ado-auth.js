// src/api/ado-auth.js
// Authentication provider abstraction for the Azure DevOps client (T2.1).
//
// Purpose
// -------
// The client NEVER embeds a credential, NEVER stores a token, and NEVER extracts
// a cookie or session token from the page (goal sections 1 & 5). Authentication
// is delegated to an injectable PROVIDER with a tiny, testable contract:
//
//   isAvailable() -> boolean | Promise<boolean>
//       Whether this provider believes a request can be authenticated right now.
//   decorate(init) -> RequestInit | Promise<RequestInit>
//       Return the fetch init, optionally adding auth. It MUST NOT be logged.
//   describe() -> { strategy, notes }
//       A credential-free description for diagnostics/docs.
//
// Two providers ship here:
//
//   1. sessionCookieProvider (DEFAULT, same-origin)
//      For a content script injected into the live dev.azure.com page, a
//      same-origin fetch with `credentials: 'include'` reuses the user's EXISTING
//      browser session cookie. No token is read, stored or constructed by the
//      extension. This is the path hypothesized in DATA_ACCESS_SPIKE.md §2.1 and
//      is NOT yet proven against a live tenant — see describe().notes and the
//      spike doc. It adds NO Authorization header.
//
//   2. nullProvider
//      Reports unavailable and adds nothing. Used when the flag is on but no
//      real auth is configured, so canMakeRequests() stays false and the runtime
//      degrades gracefully instead of issuing an unauthenticated call.
//
// The recommended long-term path for a DISTRIBUTED extension is Microsoft Entra
// ID OAuth (authorization code + PKCE via chrome.identity.launchWebAuthFlow),
// NOT a persisted PAT. That provider is intentionally left as an injectable seam
// (an Entra provider can be supplied later) because it depends on an app
// registration that is an administrative dependency recorded in the spike doc.
//
// Security: no provider here logs, returns or persists a token. The session
// cookie is handled by the browser, never touched by this code.
//
// Dual environment support:
// - Node test runner: module.exports (CommonJS).
// - Chrome runtime: attaches to window.WIPBoardAdoAuth.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoAuth = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const Strategy = Object.freeze({
    SESSION_COOKIE: 'session-cookie',
    NULL: 'null',
    ENTRA_OAUTH: 'entra-oauth', // reserved; supplied via a custom provider
  });

  // Default provider: same-origin session cookie. It adds credentials:'include'
  // so the browser attaches the signed-in session, and nothing else. It reports
  // available only when told the execution context is same-origin with the ADO
  // host (the content script is), because cookies are not sent cross-origin.
  function sessionCookieProvider(options) {
    const opts = options || {};
    // sameOrigin defaults to true because the production consumer is a content
    // script injected into the ADO page. Tests pass false to prove the gate.
    const sameOrigin = opts.sameOrigin !== false;

    return {
      isAvailable: function () {
        return sameOrigin === true;
      },
      decorate: function (init) {
        const base = init || {};
        // credentials:'include' reuses the existing session cookie. No token is
        // read or added. Never log the returned init (it carries no secret, but
        // the no-log rule is kept uniformly).
        return Object.assign({}, base, { credentials: 'include' });
      },
      describe: function () {
        return {
          strategy: Strategy.SESSION_COOKIE,
          notes:
            'Same-origin fetch reuses the browser session cookie; no PAT/token ' +
            'is stored. Hypothesized in DATA_ACCESS_SPIKE.md and NOT yet proven ' +
            'against a live tenant.',
        };
      },
    };
  }

  // Null provider: never available, decorates with nothing. Keeps the flag-on /
  // no-auth state safe (no unauthenticated call is issued).
  function nullProvider() {
    return {
      isAvailable: function () {
        return false;
      },
      decorate: function (init) {
        return Object.assign({}, init || {});
      },
      describe: function () {
        return {
          strategy: Strategy.NULL,
          notes: 'No authentication configured; API requests are not permitted.',
        };
      },
    };
  }

  // Validate that an injected object satisfies the provider contract. Returns the
  // provider when valid; throws a TypeError otherwise (caught by the flag gate).
  function assertProvider(provider) {
    if (
      !provider ||
      typeof provider.isAvailable !== 'function' ||
      typeof provider.decorate !== 'function'
    ) {
      throw new TypeError('auth provider must implement isAvailable() and decorate()');
    }
    return provider;
  }

  return {
    Strategy: Strategy,
    sessionCookieProvider: sessionCookieProvider,
    nullProvider: nullProvider,
    assertProvider: assertProvider,
  };
});
