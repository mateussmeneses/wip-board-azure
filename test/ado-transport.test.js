// test/ado-transport.test.js
// Unit tests for the injectable HTTP transport (T2.1).
// Covers: injected fetch, read-only method policy (only GET + WIQL POST),
// auth decoration, HTTP 401/403/404/429/5xx handling, timeout, network/CORS,
// malformed JSON, bounded retry + backoff (never infinite), Retry-After,
// and that no mutating request is ever sent.

const test = require('node:test');
const assert = require('node:assert/strict');

const Transport = require('../src/api/ado-transport.js');
const { ErrorCategory } = require('../src/api/ado-errors.js');
const { createMockFetch, stubAuthProvider, immediateSleep } = require('./helpers/mock-fetch.js');

function makeTransport(fetchMock, extra) {
  return Transport.createTransport(Object.assign({
    fetch: fetchMock.fetch,
    authProvider: stubAuthProvider({ available: true }),
    sleep: immediateSleep(),
    random: function () { return 0.5; }, // deterministic jitter
  }, extra || {}));
}

test('a successful GET returns parsed JSON and decorates with credentials', async () => {
  const mock = createMockFetch([{ status: 200, json: { value: [1, 2] } }]);
  const t = makeTransport(mock);
  const data = await t.send({ method: 'GET', url: 'https://dev.azure.com/x?api-version=7.1' });
  assert.deepEqual(data, { value: [1, 2] });
  assert.equal(mock.lastCall().credentials, 'include');
});

test('a mutating method is rejected before any fetch (read-only policy)', async () => {
  const mock = createMockFetch([]);
  const t = makeTransport(mock);
  await assert.rejects(
    () => t.send({ method: 'DELETE', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.DISALLOWED
  );
  await assert.rejects(
    () => t.send({ method: 'PATCH', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.DISALLOWED
  );
  // A plain POST without the WIQL flag is also rejected.
  await assert.rejects(
    () => t.send({ method: 'POST', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.DISALLOWED
  );
  assert.equal(mock.callCount(), 0); // nothing ever left
});

test('the WIQL POST is allowed only with the explicit flag', async () => {
  const mock = createMockFetch([{ status: 200, json: { workItems: [] } }]);
  const t = makeTransport(mock);
  const data = await t.send({
    method: 'POST',
    url: 'https://dev.azure.com/x/_apis/wit/wiql?api-version=7.1',
    body: JSON.stringify({ query: 'SELECT [System.Id] FROM workitems' }),
    allowWiqlPost: true,
  });
  assert.deepEqual(data, { workItems: [] });
  assert.equal(mock.lastCall().method, 'POST');
});

test('HTTP 401 surfaces UNAUTHORIZED and is NOT retried', async () => {
  const mock = createMockFetch([{ status: 401, json: {} }]);
  const t = makeTransport(mock);
  await assert.rejects(
    () => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.UNAUTHORIZED && e.status === 401
  );
  assert.equal(mock.callCount(), 1); // no retry
});

test('HTTP 403 and 404 surface their categories and are not retried', async () => {
  const mock403 = createMockFetch([{ status: 403, json: {} }]);
  await assert.rejects(
    () => makeTransport(mock403).send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.FORBIDDEN
  );
  assert.equal(mock403.callCount(), 1);

  const mock404 = createMockFetch([{ status: 404, json: {} }]);
  await assert.rejects(
    () => makeTransport(mock404).send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.NOT_FOUND
  );
  assert.equal(mock404.callCount(), 1);
});

test('HTTP 429 is retried with a bounded count then surfaces RATE_LIMITED', async () => {
  const mock = createMockFetch([
    { status: 429, headers: { 'Retry-After': '1' }, json: {} },
    { status: 429, json: {} },
    { status: 429, json: {} },
    { status: 429, json: {} },
  ]);
  const t = makeTransport(mock, { options: { maxRetries: 3 } });
  await assert.rejects(
    () => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.RATE_LIMITED
  );
  // 1 initial + 3 retries = 4 attempts, never more (no infinite retry).
  assert.equal(mock.callCount(), 4);
});

test('a 429 that later succeeds resolves after retrying', async () => {
  const mock = createMockFetch([
    { status: 429, json: {} },
    { status: 200, json: { ok: true } },
  ]);
  const t = makeTransport(mock, { options: { maxRetries: 3 } });
  const data = await t.send({ method: 'GET', url: 'https://dev.azure.com/x' });
  assert.deepEqual(data, { ok: true });
  assert.equal(mock.callCount(), 2);
});

test('HTTP 5xx is retried then surfaces SERVER_ERROR', async () => {
  const mock = createMockFetch([
    { status: 500, json: {} },
    { status: 503, json: {} },
  ]);
  const t = makeTransport(mock, { options: { maxRetries: 1 } });
  await assert.rejects(
    () => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.SERVER_ERROR
  );
  assert.equal(mock.callCount(), 2); // 1 initial + 1 retry
});

test('a network error (TypeError) is classified NETWORK and retried', async () => {
  const mock = createMockFetch([
    { throw: 'network' },
    { status: 200, json: { ok: 1 } },
  ]);
  const t = makeTransport(mock, { options: { maxRetries: 2 } });
  const data = await t.send({ method: 'GET', url: 'https://dev.azure.com/x' });
  assert.deepEqual(data, { ok: 1 });
  assert.equal(mock.callCount(), 2);
});

test('a persistent network error surfaces NETWORK after bounded retries', async () => {
  const mock = createMockFetch([{ throw: 'network' }, { throw: 'network' }, { throw: 'network' }]);
  const t = makeTransport(mock, { options: { maxRetries: 2 } });
  await assert.rejects(
    () => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.NETWORK
  );
  assert.equal(mock.callCount(), 3);
});

test('an abort is classified TIMEOUT', async () => {
  const mock = createMockFetch([{ throw: 'abort' }, { throw: 'abort' }]);
  const t = makeTransport(mock, { options: { maxRetries: 1 } });
  await assert.rejects(
    () => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.TIMEOUT
  );
});

test('a 200 with malformed JSON surfaces MALFORMED and is not retried', async () => {
  const mock = createMockFetch([{ status: 200, malformed: true }]);
  const t = makeTransport(mock);
  await assert.rejects(
    () => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }),
    (e) => e.category === ErrorCategory.MALFORMED
  );
  assert.equal(mock.callCount(), 1);
});

test('the logger receives only a safe, credential-free projection', async () => {
  const logged = [];
  const mock = createMockFetch([{ status: 403, json: {} }]);
  const t = makeTransport(mock, { logger: function (safe) { logged.push(safe); } });
  await assert.rejects(() => t.send({ method: 'GET', url: 'https://dev.azure.com/x' }));
  assert.equal(logged.length, 1);
  assert.equal(logged[0].category, ErrorCategory.FORBIDDEN);
  assert.ok(!('headers' in logged[0]));
  assert.ok(!('body' in logged[0]));
});

test('backoff is bounded by maxDelayMs and honors Retry-After', () => {
  const mock = createMockFetch([]);
  const t = makeTransport(mock, { options: { baseDelayMs: 300, maxDelayMs: 5000 } });
  // Retry-After wins and is capped.
  assert.equal(t._backoffDelay(0, 2), 2000);
  assert.equal(t._backoffDelay(0, 100), 5000); // capped
  // Exponential growth stays within the cap (+/-10% jitter).
  const big = t._backoffDelay(10, null);
  assert.ok(big <= 5000 * 1.1);
});

test('createTransport requires an injected fetch', () => {
  assert.throws(() => Transport.createTransport({}), TypeError);
});
