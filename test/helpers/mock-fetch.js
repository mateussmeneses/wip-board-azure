// test/helpers/mock-fetch.js
// A tiny, zero-dependency mock of the fetch API for the Azure DevOps client
// tests. No live network ever runs (TEST_STRATEGY.md principle 3).
//
// The mock lets a test queue responses/errors per call and records every request
// (url, method, headers, body) so tests can assert read-only behavior, batching,
// scoping and that NO mutating request was ever issued.
//
// All comments are in English per project guidelines.

'use strict';

// Build a Response-like object with the subset the transport uses:
// status, ok, headers.get(name), json().
function makeResponse(spec) {
  const s = spec || {};
  const status = typeof s.status === 'number' ? s.status : 200;
  const headers = s.headers || {};
  const body = s.json;
  return {
    status: status,
    ok: status >= 200 && status < 300,
    headers: {
      get: function (name) {
        const key = Object.keys(headers).find(function (k) {
          return k.toLowerCase() === String(name).toLowerCase();
        });
        return key ? headers[key] : null;
      },
    },
    json: function () {
      if (s.malformed === true) {
        return Promise.reject(new Error('invalid json'));
      }
      return Promise.resolve(body);
    },
  };
}

// createMockFetch(script)
//   script: array of step descriptors consumed in order, one per fetch call.
//     { json, status?, headers? }        -> resolve a Response
//     { malformed: true }                -> resolve a 200 whose json() rejects
//     { throw: Error | 'network' | 'abort' } -> reject the fetch itself
//   A function can be passed instead to compute a step from (url, init, index).
function createMockFetch(script) {
  const steps = Array.isArray(script) ? script.slice() : [];
  const calls = [];
  let index = 0;

  function fetchImpl(url, init) {
    const callIndex = index;
    index += 1;
    const step = typeof script === 'function'
      ? script(url, init, callIndex)
      : steps[callIndex];

    calls.push({
      url: url,
      method: (init && init.method) || 'GET',
      headers: Object.assign({}, init && init.headers),
      body: init && init.body,
      credentials: init && init.credentials,
      signal: init && init.signal,
    });

    if (!step) {
      return Promise.resolve(makeResponse({ status: 200, json: {} }));
    }
    if (step.throw) {
      if (step.throw === 'network' || step.throw === true) {
        const err = new TypeError('Failed to fetch');
        return Promise.reject(err);
      }
      if (step.throw === 'abort') {
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }
      return Promise.reject(step.throw);
    }
    return Promise.resolve(makeResponse(step));
  }

  return {
    fetch: fetchImpl,
    calls: calls,
    callCount: function () { return calls.length; },
    lastCall: function () { return calls[calls.length - 1] || null; },
  };
}

// An auth provider stub for tests: configurable availability, records whether
// decorate ran, and never returns a token.
function stubAuthProvider(options) {
  const opts = options || {};
  return {
    isAvailable: function () {
      return opts.available !== false;
    },
    decorate: function (init) {
      return Object.assign({}, init, { credentials: 'include' });
    },
    describe: function () {
      return { strategy: opts.strategy || 'test', notes: 'test provider' };
    },
  };
}

// A chrome.storage.sync stub holding the feature flag value.
function stubSyncStorage(values) {
  const data = Object.assign({}, values);
  return {
    get: function (keys, cb) {
      const result = {};
      const list = Array.isArray(keys) ? keys : [keys];
      list.forEach(function (k) {
        if (k in data) result[k] = data[k];
      });
      // Mirror the async callback contract.
      queueMicrotask(function () { cb(result); });
    },
  };
}

// An immediate sleep so retry/backoff tests do not wait real time.
function immediateSleep() {
  return function () { return Promise.resolve(); };
}

module.exports = {
  makeResponse: makeResponse,
  createMockFetch: createMockFetch,
  stubAuthProvider: stubAuthProvider,
  stubSyncStorage: stubSyncStorage,
  immediateSleep: immediateSleep,
};
