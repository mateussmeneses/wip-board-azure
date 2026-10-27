// test/ado-contracts.test.js
// Unit tests for the normalized data contracts (T2.1).
// Covers: iteration normalization (incl. missing dates), current-iteration
// selection (incl. team with no current sprint), iteration work item id dedupe,
// work item normalization, State-vs-BoardColumn distinction, UNAVAILABLE for
// absent fields, board column normalization, capability honesty.

const test = require('node:test');
const assert = require('node:assert/strict');

const C = require('../src/api/ado-contracts.js');

// --- iterations --------------------------------------------------------------

test('normalizeIterations maps id/name/path/dates/timeframe', () => {
  const payload = {
    value: [
      {
        id: 'it-1',
        name: 'Sprint 1',
        path: 'Sda.Arms\\Sprint 1',
        attributes: { startDate: '2024-01-01T00:00:00Z', finishDate: '2024-01-14T00:00:00Z', timeFrame: 'current' },
      },
    ],
  };
  const out = C.normalizeIterations(payload);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'it-1');
  assert.equal(out[0].name, 'Sprint 1');
  assert.equal(out[0].timeframe, 'current');
  assert.equal(out[0].startDate, '2024-01-01T00:00:00Z');
});

test('iteration without dates preserves them as UNAVAILABLE, not null/0', () => {
  const payload = { value: [{ id: 'it-2', name: 'Future', path: 'p', attributes: { timeFrame: 'future' } }] };
  const out = C.normalizeIterations(payload);
  assert.ok(C.isUnavailable(out[0].startDate));
  assert.ok(C.isUnavailable(out[0].finishDate));
  assert.equal(out[0].timeframe, 'future');
});

test('selectCurrentIteration returns the current one', () => {
  const list = [
    { id: 'a', timeframe: 'past' },
    { id: 'b', timeframe: 'current' },
    { id: 'c', timeframe: 'future' },
  ];
  assert.equal(C.selectCurrentIteration(list).id, 'b');
});

test('selectCurrentIteration returns null when the team has no current sprint', () => {
  const list = [
    { id: 'a', timeframe: 'past' },
    { id: 'c', timeframe: 'future' },
  ];
  assert.equal(C.selectCurrentIteration(list), null);
  assert.equal(C.selectCurrentIteration([]), null);
});

// --- iteration work items ----------------------------------------------------

test('normalizeIterationWorkItemIds dedupes and preserves first-seen order', () => {
  const payload = {
    workItemRelations: [
      { target: { id: 10 } },
      { target: { id: 11 } },
      { target: { id: 10 } }, // duplicate reference
      { rel: 'System.LinkTypes.Hierarchy-Forward', target: { id: 12 } },
      { target: null },
    ],
  };
  const ids = C.normalizeIterationWorkItemIds(payload);
  assert.deepEqual(ids, [10, 11, 12]);
});

// --- work items --------------------------------------------------------------

function wi(fields, relations) {
  return { id: 620906, fields: fields, relations: relations };
}

test('normalizeWorkItem maps the required fields', () => {
  const item = C.normalizeWorkItem(wi({
    'System.Title': 'Fix login',
    'System.WorkItemType': 'Bug',
    'System.State': 'Active',
    'System.IterationPath': 'Sda.Arms\\Sprint 1',
    'System.AreaPath': 'Sda.Arms\\Team',
    'System.Tags': 'spa; blck',
    'Microsoft.VSTS.Scheduling.StoryPoints': 5,
  }));
  assert.equal(item.id, 620906);
  assert.equal(item.title, 'Fix login');
  assert.equal(item.type, 'Bug');
  assert.equal(item.state, 'Active');
  assert.equal(item.iterationPath, 'Sda.Arms\\Sprint 1');
  assert.equal(item.areaPath, 'Sda.Arms\\Team');
  assert.deepEqual(item.tags, ['spa', 'blck']);
  assert.equal(item.storyPoints, 5);
});

test('State is kept DISTINCT from the board column; a state named Closed is not the Closed column', () => {
  // A classic board column field with a value different from System.State.
  const item = C.normalizeWorkItem(wi({
    'System.State': 'Closed',
    'System.BoardColumn': 'In Review',
  }));
  assert.equal(item.state, 'Closed');
  assert.equal(item.boardColumn, 'In Review');
  assert.notEqual(item.state, item.boardColumn);
});

test('board column read from a dynamic WEF_* field with its Done flag', () => {
  const item = C.normalizeWorkItem(wi({
    'System.State': 'Active',
    'WEF_abc123_Kanban.Column': 'Doing',
    'WEF_abc123_Kanban.Column.Done': true,
  }));
  assert.equal(item.boardColumn, 'Doing');
  assert.equal(item.boardColumnDone, true);
});

test('absent board column stays UNAVAILABLE (never confused with a real column)', () => {
  const item = C.normalizeWorkItem(wi({ 'System.State': 'Active' }));
  assert.ok(C.isUnavailable(item.boardColumn));
  assert.ok(C.isUnavailable(item.boardColumnDone));
});

test('absent story points stay UNAVAILABLE, not 0; Effort is used as a fallback', () => {
  const noEstimate = C.normalizeWorkItem(wi({ 'System.State': 'Active' }));
  assert.ok(C.isUnavailable(noEstimate.storyPoints));

  const effortOnly = C.normalizeWorkItem(wi({ 'System.State': 'Active', 'Microsoft.VSTS.Scheduling.Effort': 8 }));
  assert.equal(effortOnly.storyPoints, 8);
});

test('parent id is read from System.Parent or the Hierarchy-Reverse relation', () => {
  const byField = C.normalizeWorkItem(wi({ 'System.Parent': 42 }));
  assert.equal(byField.parentId, 42);

  const byRelation = C.normalizeWorkItem(wi({}, [
    { rel: 'System.LinkTypes.Hierarchy-Reverse', url: 'https://x/_apis/wit/workItems/99' },
  ]));
  assert.equal(byRelation.parentId, 99);
});

test('tags: empty string yields [], missing yields UNAVAILABLE', () => {
  const empty = C.normalizeWorkItem(wi({ 'System.Tags': '' }));
  assert.deepEqual(empty.tags, []);
  const missing = C.normalizeWorkItem(wi({}));
  assert.ok(C.isUnavailable(missing.tags));
});

// --- board columns -----------------------------------------------------------

test('normalizeBoardColumns preserves order, names, mappings and flags the outgoing column as done', () => {
  const payload = {
    value: [
      { id: 'c0', name: 'Approved', columnType: 'incoming', stateMappings: { Bug: 'Approved' } },
      { id: 'c1', name: 'Doing', columnType: 'inProgress', itemLimit: 3, stateMappings: { Bug: 'Active' } },
      { id: 'c2', name: 'Closed', columnType: 'outgoing', stateMappings: { Bug: 'Closed' } },
    ],
  };
  const cols = C.normalizeBoardColumns(payload);
  assert.equal(cols.length, 3);
  assert.deepEqual(cols.map((c) => c.name), ['Approved', 'Doing', 'Closed']);
  assert.deepEqual(cols.map((c) => c.order), [0, 1, 2]);
  assert.equal(cols[2].isDoneColumn, true);
  assert.equal(cols[0].isDoneColumn, false);
  assert.equal(cols[1].itemLimit, 3);
  assert.deepEqual(cols[2].stateMappings, { Bug: 'Closed' });
});

test('column without stateMappings keeps them UNAVAILABLE', () => {
  const cols = C.normalizeBoardColumns({ value: [{ id: 'c', name: 'X', columnType: 'inProgress' }] });
  assert.ok(C.isUnavailable(cols[0].stateMappings));
});

// --- capability --------------------------------------------------------------

test('buildCapability defaults liveAccessProven to false (honesty)', () => {
  const cap = C.buildCapability({ featureFlagEnabled: true, authStrategy: 'session-cookie', authAvailable: true });
  assert.equal(cap.liveAccessProven, false);
  assert.equal(cap.featureFlagEnabled, true);
  assert.equal(cap.authStrategy, 'session-cookie');
  assert.ok(Object.isFrozen(cap));
});
