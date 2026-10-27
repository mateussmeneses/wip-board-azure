// test/ado-client.test.js
// Integration tests for the Azure DevOps read-only client composition (T2.1).
// Covers: feature flag OFF => no request; current sprint retrieval; team with no
// active sprint; iterations with missing dates; work item retrieval; batching
// >200 ids; duplicate ids collapsed; board column normalization; State vs board
// column; partial data; WIQL read-only query; CORS/network; org/project/team
// isolation; and the ABSENCE of any mutating request.

const test = require('node:test');
const assert = require('node:assert/strict');

const Client = require('../src/api/ado-client.js');
const { ErrorCategory } = require('../src/api/ado-errors.js');
const {
  createMockFetch,
  stubAuthProvider,
  stubSyncStorage,
  immediateSleep,
} = require('./helpers/mock-fetch.js');

const SCOPE = { organization: 'sda-iatec', project: 'Sda.Arms', team: 'Alpha', board: 'Stories' };

// Build a client with the flag ON and auth available, unless overridden.
function enabledClient(fetchMock, extra) {
  return Client.createClient(Object.assign({
    fetch: fetchMock.fetch,
    authProvider: stubAuthProvider({ available: true, strategy: 'session-cookie' }),
    storage: stubSyncStorage({ azureApiEnabled: true }),
    sleep: immediateSleep(),
    random: function () { return 0.5; },
  }, extra || {}));
}

// --- feature flag OFF => no REST call ---------------------------------------

test('with the flag OFF, no method issues any fetch and all reject with DISALLOWED', async () => {
  const mock = createMockFetch([]);
  const client = Client.createClient({
    fetch: mock.fetch,
    authProvider: stubAuthProvider({ available: true }),
    storage: stubSyncStorage({ azureApiEnabled: false }),
  });

  await assert.rejects(() => client.getIterations(SCOPE), (e) => e.category === ErrorCategory.DISALLOWED);
  await assert.rejects(() => client.getCurrentIteration(SCOPE), (e) => e.category === ErrorCategory.DISALLOWED);
  await assert.rejects(() => client.getWorkItems(SCOPE, [1]), (e) => e.category === ErrorCategory.DISALLOWED);
  await assert.rejects(() => client.getBoardColumns(SCOPE, 'Stories'), (e) => e.category === ErrorCategory.DISALLOWED);
  await assert.rejects(() => client.queryWiql(SCOPE, 'SELECT [System.Id] FROM workitems'), (e) => e.category === ErrorCategory.DISALLOWED);

  assert.equal(mock.callCount(), 0); // the DOM runtime is never disturbed
});

test('with the flag ON but auth unavailable, still no fetch and DISALLOWED', async () => {
  const mock = createMockFetch([]);
  const client = Client.createClient({
    fetch: mock.fetch,
    authProvider: stubAuthProvider({ available: false }),
    storage: stubSyncStorage({ azureApiEnabled: true }),
  });
  await assert.rejects(() => client.getIterations(SCOPE), (e) => e.category === ErrorCategory.DISALLOWED);
  assert.equal(mock.callCount(), 0);
});

// --- iterations --------------------------------------------------------------

test('getCurrentIteration returns the current sprint', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: {
      value: [
        { id: 'i0', name: 'S0', path: 'p0', attributes: { timeFrame: 'past' } },
        { id: 'i1', name: 'S1', path: 'p1', attributes: { startDate: '2024-01-01', finishDate: '2024-01-14', timeFrame: 'current' } },
      ],
    },
  }]);
  const current = await enabledClient(mock).getCurrentIteration(SCOPE);
  assert.equal(current.id, 'i1');
  assert.equal(current.timeframe, 'current');
  assert.equal(current.startDate, '2024-01-01');
});

test('getCurrentIteration returns null for a team with no active sprint', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: { value: [{ id: 'i0', name: 'S0', path: 'p0', attributes: { timeFrame: 'past' } }] },
  }]);
  const current = await enabledClient(mock).getCurrentIteration(SCOPE);
  assert.equal(current, null);
});

test('iterations with missing dates come back as UNAVAILABLE', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: { value: [{ id: 'i1', name: 'S1', path: 'p1', attributes: { timeFrame: 'current' } }] },
  }]);
  const list = await enabledClient(mock).getIterations(SCOPE);
  assert.ok(Client.contracts.isUnavailable(list[0].startDate));
  assert.ok(Client.contracts.isUnavailable(list[0].finishDate));
});

// --- iteration work item ids -------------------------------------------------

test('getIterationWorkItemIds dedupes duplicate references', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: { workItemRelations: [{ target: { id: 7 } }, { target: { id: 8 } }, { target: { id: 7 } }] },
  }]);
  const ids = await enabledClient(mock).getIterationWorkItemIds(SCOPE, 'i1');
  assert.deepEqual(ids, [7, 8]);
});

// --- work items & batching ---------------------------------------------------

test('getWorkItems with an empty id list makes no request and returns []', async () => {
  const mock = createMockFetch([]);
  const items = await enabledClient(mock).getWorkItems(SCOPE, []);
  assert.deepEqual(items, []);
  assert.equal(mock.callCount(), 0);
});

test('getWorkItems splits >200 ids into bounded batches and concatenates', async () => {
  // 450 unique ids => 3 batches (200 + 200 + 50).
  const ids = [];
  for (let i = 1; i <= 450; i += 1) ids.push(i);

  const mock = createMockFetch(function (url, init, i) {
    // Return one work item per requested id so we can assert concatenation.
    const decoded = decodeURIComponent(url);
    const idsParam = decoded.match(/ids=([^&]*)/)[1].split(',').map(Number);
    return {
      status: 200,
      json: { value: idsParam.map((id) => ({ id: id, fields: { 'System.State': 'Active' } })) },
    };
  });

  const client = enabledClient(mock);
  const items = await client.getWorkItems(SCOPE, ids);
  assert.equal(items.length, 450);
  assert.equal(mock.callCount(), 3);

  // Each batch must carry at most 200 ids (the REST cap).
  mock.calls.forEach(function (call) {
    const idsParam = decodeURIComponent(call.url).match(/ids=([^&]*)/)[1].split(',');
    assert.ok(idsParam.length <= 200);
  });
});

test('getWorkItems collapses duplicate ids before batching', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: { value: [{ id: 5, fields: { 'System.State': 'Active' } }] },
  }]);
  const items = await enabledClient(mock).getWorkItems(SCOPE, [5, 5, 5]);
  assert.equal(items.length, 1);
  const idsParam = decodeURIComponent(mock.lastCall().url).match(/ids=([^&]*)/)[1];
  assert.equal(idsParam, '5');
});

test('work item State is distinct from the board column and partial data stays UNAVAILABLE', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: {
      value: [
        { id: 1, fields: { 'System.State': 'Closed', 'System.BoardColumn': 'In Review' } },
        { id: 2, fields: { 'System.State': 'Active' } }, // no board column, no points
      ],
    },
  }]);
  const items = await enabledClient(mock).getWorkItems(SCOPE, [1, 2]);
  assert.equal(items[0].state, 'Closed');
  assert.equal(items[0].boardColumn, 'In Review');
  assert.ok(Client.contracts.isUnavailable(items[1].boardColumn));
  assert.ok(Client.contracts.isUnavailable(items[1].storyPoints));
});

// --- board columns -----------------------------------------------------------

test('getBoardColumns normalizes order, names and the done column', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: {
      value: [
        { id: 'c0', name: 'Approved', columnType: 'incoming' },
        { id: 'c1', name: 'Doing', columnType: 'inProgress' },
        { id: 'c2', name: 'Closed', columnType: 'outgoing' },
      ],
    },
  }]);
  const cols = await enabledClient(mock).getBoardColumns(SCOPE, 'Stories');
  assert.deepEqual(cols.map((c) => c.name), ['Approved', 'Doing', 'Closed']);
  assert.equal(cols[2].isDoneColumn, true);
});

// --- WIQL (read-only POST) ---------------------------------------------------

test('queryWiql issues the single allowed POST and returns deduped ids', async () => {
  const mock = createMockFetch([{
    status: 200,
    json: { workItems: [{ id: 11 }, { id: 12 }, { id: 11 }] },
  }]);
  const ids = await enabledClient(mock).queryWiql(SCOPE, 'SELECT [System.Id] FROM workitems');
  assert.deepEqual(ids, [11, 12]);
  const call = mock.lastCall();
  assert.equal(call.method, 'POST');
  assert.ok(call.url.includes('/_apis/wit/wiql'));
  assert.ok(String(call.body).includes('SELECT'));
});

// --- resilience --------------------------------------------------------------

test('a network/CORS failure surfaces NETWORK without crashing the caller', async () => {
  const mock = createMockFetch([{ throw: 'network' }, { throw: 'network' }, { throw: 'network' }, { throw: 'network' }]);
  await assert.rejects(
    () => enabledClient(mock, { options: { maxRetries: 3 } }).getIterations(SCOPE),
    (e) => e.category === ErrorCategory.NETWORK
  );
});

// --- isolation ---------------------------------------------------------------

test('requests are scoped per org/project/team (isolation)', async () => {
  const mock = createMockFetch([
    { status: 200, json: { value: [] } },
    { status: 200, json: { value: [] } },
  ]);
  const client = enabledClient(mock);
  await client.getIterations(SCOPE);
  await client.getIterations(Object.assign({}, SCOPE, { team: 'Beta' }));
  assert.ok(mock.calls[0].url.includes('/Alpha/'));
  assert.ok(mock.calls[1].url.includes('/Beta/'));
  assert.notEqual(mock.calls[0].url, mock.calls[1].url);
});

// --- read-only guarantee -----------------------------------------------------

test('across the whole client, the ONLY non-GET request is the WIQL POST', async () => {
  const mock = createMockFetch(function () { return { status: 200, json: { value: [], workItems: [], workItemRelations: [] } }; });
  const client = enabledClient(mock);
  await client.getIterations(SCOPE);
  await client.getIterationWorkItemIds(SCOPE, 'i1');
  await client.getWorkItems(SCOPE, [1, 2]);
  await client.getBoardColumns(SCOPE, 'Stories');
  await client.queryWiql(SCOPE, 'SELECT [System.Id] FROM workitems');

  const methods = mock.calls.map((c) => String(c.method).toUpperCase());
  const nonGet = methods.filter((m) => m !== 'GET');
  assert.deepEqual(nonGet, ['POST']); // exactly one POST, and it is the WIQL query
  // No PUT/PATCH/DELETE ever appeared.
  ['PUT', 'PATCH', 'DELETE'].forEach((m) => assert.ok(!methods.includes(m)));
});

// --- capability honesty ------------------------------------------------------

test('describeCapability reports flag/auth state and never claims proven live access', async () => {
  const mock = createMockFetch([]);
  const cap = await enabledClient(mock).describeCapability();
  assert.equal(cap.featureFlagEnabled, true);
  assert.equal(cap.authAvailable, true);
  assert.equal(cap.authStrategy, 'session-cookie');
  assert.equal(cap.liveAccessProven, false);
  assert.deepEqual(cap.endpointsImplemented.sort(), Client.Endpoints.slice().sort());
});

test('default authentication refuses requests even when feature flag is enabled', async () => {
  const mock = createMockFetch([]);
  const client = Client.createClient({
    fetch: mock.fetch,
    storage: stubSyncStorage({ azureApiEnabled: true }),
  });
  await assert.rejects(() => client.getIterations(SCOPE),
    (e) => e.category === ErrorCategory.DISALLOWED);
  assert.equal(mock.callCount(), 0);
});
