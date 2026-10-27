// test/ado-auth.test.js
// Unit tests for the authentication provider abstraction (T2.1).
// Covers: session-cookie provider (same-origin availability, credentials:include,
// no token), null provider, provider contract validation, no credential leakage.

const test = require('node:test');
const assert = require('node:assert/strict');

const Auth = require('../src/api/ado-auth.js');

test('sessionCookieProvider is available same-origin and unavailable cross-origin', () => {
  const same = Auth.sessionCookieProvider();
  assert.equal(same.isAvailable(), true);
  const cross = Auth.sessionCookieProvider({ sameOrigin: false });
  assert.equal(cross.isAvailable(), false);
});

test('sessionCookieProvider decorates with credentials:include and NO Authorization header', () => {
  const provider = Auth.sessionCookieProvider();
  const init = provider.decorate({ method: 'GET', headers: { Accept: 'application/json' } });
  assert.equal(init.credentials, 'include');
  // Critical: it never injects an Authorization header or any token.
  assert.ok(!('Authorization' in (init.headers || {})));
  assert.equal(JSON.stringify(init).toLowerCase().includes('bearer'), false);
});

test('sessionCookieProvider describe() is credential-free and marks the path unproven', () => {
  const d = Auth.sessionCookieProvider().describe();
  assert.equal(d.strategy, Auth.Strategy.SESSION_COOKIE);
  assert.match(d.notes, /not yet proven/i);
});

test('nullProvider is never available and adds nothing', () => {
  const provider = Auth.nullProvider();
  assert.equal(provider.isAvailable(), false);
  const init = provider.decorate({ method: 'GET' });
  assert.equal(init.credentials, undefined);
  assert.equal(provider.describe().strategy, Auth.Strategy.NULL);
});

test('assertProvider accepts a valid provider and rejects an invalid one', () => {
  assert.doesNotThrow(() => Auth.assertProvider(Auth.sessionCookieProvider()));
  assert.throws(() => Auth.assertProvider({}), TypeError);
  assert.throws(() => Auth.assertProvider({ isAvailable: function () {} }), TypeError);
  assert.throws(() => Auth.assertProvider(null), TypeError);
});
