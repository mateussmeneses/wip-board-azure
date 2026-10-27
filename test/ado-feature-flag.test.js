// test/ado-feature-flag.test.js
// Unit tests for the feature-flag gate (T2.1).
// Covers: default OFF, explicit true enables, fail-safe on missing storage,
// and the combined gate (flag on + available auth required).

const test = require('node:test');
const assert = require('node:assert/strict');

const Flag = require('../src/api/ado-feature-flag.js');
const { stubSyncStorage, stubAuthProvider } = require('./helpers/mock-fetch.js');

test('the flag is disabled by default', () => {
  assert.equal(Flag.DEFAULT_ENABLED, false);
  assert.equal(Flag.FLAG_KEY, 'azureApiEnabled');
});

test('isEnabled resolves false when the key is absent', async () => {
  const enabled = await Flag.isEnabled(stubSyncStorage({}));
  assert.equal(enabled, false);
});

test('isEnabled resolves true only for an explicit boolean true', async () => {
  assert.equal(await Flag.isEnabled(stubSyncStorage({ azureApiEnabled: true })), true);
  assert.equal(await Flag.isEnabled(stubSyncStorage({ azureApiEnabled: 'true' })), false);
  assert.equal(await Flag.isEnabled(stubSyncStorage({ azureApiEnabled: 1 })), false);
});

test('isEnabled is fail-safe: no chrome storage resolves to disabled', async () => {
  const enabled = await Flag.isEnabled(null);
  assert.equal(enabled, false);
});

test('canMakeRequests is false when the flag is off, regardless of auth', async () => {
  const ok = await Flag.canMakeRequests({
    storage: stubSyncStorage({ azureApiEnabled: false }),
    authProvider: stubAuthProvider({ available: true }),
  });
  assert.equal(ok, false);
});

test('canMakeRequests is false when the flag is on but auth is unavailable', async () => {
  const ok = await Flag.canMakeRequests({
    storage: stubSyncStorage({ azureApiEnabled: true }),
    authProvider: stubAuthProvider({ available: false }),
  });
  assert.equal(ok, false);
});

test('canMakeRequests is false when the flag is on but no provider is supplied', async () => {
  const ok = await Flag.canMakeRequests({
    storage: stubSyncStorage({ azureApiEnabled: true }),
  });
  assert.equal(ok, false);
});

test('canMakeRequests is true only when the flag is on AND auth is available', async () => {
  const ok = await Flag.canMakeRequests({
    storage: stubSyncStorage({ azureApiEnabled: true }),
    authProvider: stubAuthProvider({ available: true }),
  });
  assert.equal(ok, true);
});

test('an auth provider that throws on isAvailable is treated as unavailable', async () => {
  const throwing = {
    isAvailable: function () { throw new Error('boom'); },
    decorate: function (i) { return i; },
  };
  const ok = await Flag.canMakeRequests({
    storage: stubSyncStorage({ azureApiEnabled: true }),
    authProvider: throwing,
  });
  assert.equal(ok, false);
});
