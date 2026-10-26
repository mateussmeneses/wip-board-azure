// test/helpers/mock-chrome-storage.js
// A tiny in-memory mock of the chrome.storage.local surface used by the snapshot
// store. Zero dependencies; mirrors the callback-based Chrome API the adapter
// expects (get/set/remove with a trailing callback).
//
// The mock deep-clones on write and read so stored records cannot be mutated by
// reference from the outside — this lets tests assert true persistence semantics
// (a returned record is a copy, not a live handle into the store).
//
// A `failOn` option forces a storage failure for a chosen operation so tests can
// exercise the STORAGE_FAILURE path without a real browser.
//
// All comments are in English per project guidelines.

'use strict';

function clone(value) {
  // structuredClone is available in modern Node; fall back to JSON for safety.
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch (e) {
      // Frozen objects clone fine; this guard is only for exotic values.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

// options.failOn: optional array/set of method names ('get' | 'set' | 'remove')
// that should reject via chrome.runtime.lastError semantics.
function createMockStorage(options) {
  const opts = options || {};
  const store = new Map();
  const failOn = new Set(opts.failOn || []);

  function shouldFail(method) {
    return failOn.has(method);
  }

  function invokeCallback(cb, value) {
    // chrome storage callbacks run async; emulate that with queueMicrotask so
    // ordering matches the real API and the adapter's promise resolves later.
    queueMicrotask(function () {
      cb(value);
    });
  }

  const api = {
    _store: store,
    get: function (keys, cb) {
      if (shouldFail('get')) {
        return invokeFailure(cb, 'mock get failure');
      }
      let result;
      if (keys === null || keys === undefined) {
        result = {};
        store.forEach(function (value, key) {
          result[key] = clone(value);
        });
      } else if (typeof keys === 'string') {
        result = {};
        if (store.has(keys)) result[keys] = clone(store.get(keys));
      } else if (Array.isArray(keys)) {
        result = {};
        keys.forEach(function (key) {
          if (store.has(key)) result[key] = clone(store.get(key));
        });
      } else {
        result = {};
      }
      invokeCallback(cb, result);
    },
    set: function (obj, cb) {
      if (shouldFail('set')) {
        return invokeFailure(cb, 'mock set failure');
      }
      Object.keys(obj).forEach(function (key) {
        store.set(key, clone(obj[key]));
      });
      invokeCallback(cb);
    },
    remove: function (keys, cb) {
      if (shouldFail('remove')) {
        return invokeFailure(cb, 'mock remove failure');
      }
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach(function (key) {
        store.delete(key);
      });
      invokeCallback(cb);
    },
  };

  function invokeFailure(cb, message) {
    // Emulate chrome.runtime.lastError by setting the global and clearing it
    // after the callback runs — the adapter reads it inside the callback.
    ensureChromeRuntime();
    queueMicrotask(function () {
      global.chrome.runtime.lastError = { message: message };
      try {
        cb(undefined);
      } finally {
        global.chrome.runtime.lastError = null;
      }
    });
  }

  return api;
}

function ensureChromeRuntime() {
  if (typeof global.chrome === 'undefined') {
    global.chrome = {};
  }
  if (!global.chrome.runtime) {
    global.chrome.runtime = { lastError: null };
  }
}

module.exports = { createMockStorage, ensureChromeRuntime };
