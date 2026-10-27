// src/api/ado-feature-flag.js
// Feature-flag gate for the Azure DevOps API integration (T2.1).
//
// Purpose
// -------
// The whole REST integration is OFF by default. This module is the single
// authority that decides whether any API call is permitted. With the flag off:
//   - no REST call may occur,
//   - the existing DOM + local-storage runtime is untouched,
//   - no authentication error can reach the WIP indicator.
//
// The flag is read from chrome.storage.sync under a NEW key `azureApiEnabled`
// (default false). Reading settings must never throw into the runtime: a storage
// failure or a missing Chrome surface resolves to DISABLED (fail safe), because
// "unknown" must behave like "off" for a read-only, opt-in capability.
//
// The gate also enforces that enabling the flag alone is not enough: the caller
// must ALSO supply a working auth provider. `canMakeRequests` returns false when
// the flag is on but no auth mechanism is available, so no half-configured call
// is ever issued (goal section 7).
//
// Dual environment support:
// - Node test runner: module.exports (CommonJS).
// - Chrome runtime: attaches to window.WIPBoardAdoFeatureFlag.
//
// All comments are in English per project guidelines.

(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.WIPBoardAdoFeatureFlag = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // The storage key is additive and does not collide with any key documented in
  // AGENTS.md. Default is false so an upgrade never silently enables the API.
  const FLAG_KEY = 'azureApiEnabled';
  const DEFAULT_ENABLED = false;

  function resolveSyncStorage(injected) {
    if (injected) return injected;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      return chrome.storage.sync;
    }
    return null;
  }

  // Read the flag. Resolves to a boolean and NEVER rejects: any failure is
  // treated as disabled (fail safe). `storage` is injectable for tests.
  function isEnabled(storage) {
    const sync = resolveSyncStorage(storage);
    if (!sync) return Promise.resolve(DEFAULT_ENABLED);
    return new Promise(function (resolve) {
      try {
        const maybePromise = sync.get([FLAG_KEY], function (items) {
          resolve(readFlag(items));
        });
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(
            function (items) { resolve(readFlag(items)); },
            function () { resolve(DEFAULT_ENABLED); }
          );
        }
      } catch (e) {
        resolve(DEFAULT_ENABLED);
      }
    });
  }

  function readFlag(items) {
    if (!items || typeof items !== 'object') return DEFAULT_ENABLED;
    return items[FLAG_KEY] === true; // strict: only an explicit true enables it
  }

  // Combined gate: the API may issue requests only when BOTH the flag is on AND
  // an auth provider that reports itself available is present. `authProvider`
  // must expose `isAvailable(): boolean | Promise<boolean>`.
  function canMakeRequests(options) {
    const opts = options || {};
    return isEnabled(opts.storage).then(function (enabled) {
      if (!enabled) return false;
      const provider = opts.authProvider;
      if (!provider || typeof provider.isAvailable !== 'function') {
        return false; // flag on but no auth mechanism => do not call
      }
      // Guard against a provider whose isAvailable throws SYNCHRONOUSLY as well
      // as one that rejects; either way, treat it as "not available" (fail safe).
      return Promise.resolve()
        .then(function () { return provider.isAvailable(); })
        .then(function (ok) { return ok === true; }, function () { return false; });
    });
  }

  return {
    FLAG_KEY: FLAG_KEY,
    DEFAULT_ENABLED: DEFAULT_ENABLED,
    isEnabled: isEnabled,
    canMakeRequests: canMakeRequests,
  };
});
