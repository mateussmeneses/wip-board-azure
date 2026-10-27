// test/ado-errors.test.js
// Unit tests for the structured error model (T2.1).
// Covers: status->category mapping (401/403/404/429/5xx/4xx), retryability
// policy, thrown-error classification (network/timeout), malformed/disallowed,
// and the credential-free safe projection.

const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../src/api/ado-errors.js');
const { ErrorCategory } = E;

test('status maps to the expected category', () => {
  assert.equal(E.categoryForStatus(401), ErrorCategory.UNAUTHORIZED);
  assert.equal(E.categoryForStatus(403), ErrorCategory.FORBIDDEN);
  assert.equal(E.categoryForStatus(404), ErrorCategory.NOT_FOUND);
  assert.equal(E.categoryForStatus(429), ErrorCategory.RATE_LIMITED);
  assert.equal(E.categoryForStatus(500), ErrorCategory.SERVER_ERROR);
  assert.equal(E.categoryForStatus(503), ErrorCategory.SERVER_ERROR);
  assert.equal(E.categoryForStatus(400), ErrorCategory.CLIENT_ERROR);
  assert.equal(E.categoryForStatus(405), ErrorCategory.CLIENT_ERROR);
});

test('only transient categories are retryable; auth/permission/not-found are NOT', () => {
  assert.equal(E.fromStatus(429).retryable, true);
  assert.equal(E.fromStatus(500).retryable, true);
  assert.equal(E.fromStatus(401).retryable, false);
  assert.equal(E.fromStatus(403).retryable, false);
  assert.equal(E.fromStatus(404).retryable, false);
  assert.equal(E.fromStatus(400).retryable, false);
});

test('fromStatus carries a Retry-After hint when supplied', () => {
  const err = E.fromStatus(429, { retryAfterSeconds: 7 });
  assert.equal(err.category, ErrorCategory.RATE_LIMITED);
  assert.equal(err.retryAfterSeconds, 7);
});

test('a TypeError from fetch is classified NETWORK and is retryable', () => {
  const err = E.fromThrown(new TypeError('Failed to fetch'));
  assert.equal(err.category, ErrorCategory.NETWORK);
  assert.equal(err.retryable, true);
  // The message honestly notes CORS as a possible cause without asserting it.
  assert.match(err.message, /CORS/);
});

test('an AbortError (or aborted hint) is classified TIMEOUT and is retryable', () => {
  const byName = E.fromThrown(Object.assign(new Error('x'), { name: 'AbortError' }));
  assert.equal(byName.category, ErrorCategory.TIMEOUT);
  const byHint = E.fromThrown(new Error('x'), { aborted: true });
  assert.equal(byHint.category, ErrorCategory.TIMEOUT);
  assert.equal(byHint.retryable, true);
});

test('malformed and disallowed are not retryable', () => {
  assert.equal(E.malformed().category, ErrorCategory.MALFORMED);
  assert.equal(E.malformed().retryable, false);
  assert.equal(E.disallowed().category, ErrorCategory.DISALLOWED);
  assert.equal(E.disallowed().retryable, false);
});

test('toSafeObject exposes no headers/body and only safe fields', () => {
  const err = E.fromStatus(403);
  const safe = err.toSafeObject();
  assert.deepEqual(Object.keys(safe).sort(), ['category', 'message', 'retryAfterSeconds', 'retryable', 'status'].sort());
  assert.equal(safe.status, 403);
  // No authorization/token leakage possible from this shape.
  assert.ok(!('headers' in safe));
  assert.ok(!('body' in safe));
});

test('isRetryable reflects the error flag', () => {
  assert.equal(E.isRetryable(E.fromStatus(500)), true);
  assert.equal(E.isRetryable(E.fromStatus(401)), false);
  assert.equal(E.isRetryable(null), false);
});
