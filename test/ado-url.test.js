// test/ado-url.test.js
// Unit tests for the Azure DevOps URL builder & validator (T2.1).
// Covers: safe endpoint construction, host allow-list, traversal/injection
// defense, fixed api-version, org/project/team isolation, read-only methods.

const test = require('node:test');
const assert = require('node:assert/strict');

const Url = require('../src/api/ado-url.js');

const SCOPE = { organization: 'sda-iatec', project: 'Sda.Arms', team: 'Alpha', board: 'Stories' };

test('iterations builds a GET with the fixed api-version and full scope path', () => {
  const req = Url.iterations(SCOPE);
  assert.equal(req.method, 'GET');
  assert.match(req.url, /^https:\/\/dev\.azure\.com\//);
  assert.ok(req.url.includes('/sda-iatec/'));
  assert.ok(req.url.includes('/Sda.Arms/'));
  assert.ok(req.url.includes('/Alpha/'));
  assert.ok(req.url.includes('/_apis/work/teamsettings/iterations'));
  assert.ok(req.url.endsWith('api-version=' + Url.API_VERSION));
});

test('iterationWorkItems includes the iteration id and workitems suffix', () => {
  const req = Url.iterationWorkItems(SCOPE, 'abc-123');
  assert.equal(req.method, 'GET');
  assert.ok(req.url.includes('/iterations/abc-123/workitems'));
});

test('workItems builds ids and a field selection, capped api-version', () => {
  const req = Url.workItems(SCOPE, [1, 2, 3], ['System.State', 'System.Title']);
  assert.equal(req.method, 'GET');
  assert.ok(req.url.includes('/_apis/wit/workitems'));
  assert.ok(decodeURIComponent(req.url).includes('ids=1,2,3'));
  assert.ok(decodeURIComponent(req.url).includes('fields=System.State,System.Title'));
});

test('boardColumns builds the columns endpoint for a board', () => {
  const req = Url.boardColumns(SCOPE, 'Stories');
  assert.equal(req.method, 'GET');
  assert.ok(req.url.includes('/_apis/work/boards/Stories/columns'));
});

test('wiql builds the ONLY POST endpoint', () => {
  const req = Url.wiql(SCOPE);
  assert.equal(req.method, 'POST');
  assert.ok(req.url.includes('/_apis/wit/wiql'));
});

test('a caller cannot override api-version via params', () => {
  const req = Url.workItems(SCOPE, [1], null);
  // Only one api-version occurrence, and it equals the fixed value.
  const matches = req.url.match(/api-version=/g) || [];
  assert.equal(matches.length, 1);
  assert.ok(req.url.endsWith('api-version=' + Url.API_VERSION));
});

test('path traversal in a segment is rejected', () => {
  assert.throws(
    () => Url.iterationWorkItems(SCOPE, '../../evil'),
    (e) => e.code === Url.ErrorCodes.INVALID_SEGMENT
  );
});

test('a slash in a scope value is rejected (no host injection via segment)', () => {
  const bad = Object.assign({}, SCOPE, { project: 'proj/evil' });
  assert.throws(() => Url.iterations(bad), (e) => e.code === Url.ErrorCodes.INVALID_SEGMENT);
});

test('a dot-dot scope value is rejected', () => {
  const bad = Object.assign({}, SCOPE, { team: '..' });
  assert.throws(() => Url.iterations(bad), (e) => e.code === Url.ErrorCodes.INVALID_SEGMENT);
});

test('a query/fragment character in a segment is rejected', () => {
  assert.throws(
    () => Url.boardColumns(SCOPE, 'Stories?destroy=1'),
    (e) => e.code === Url.ErrorCodes.INVALID_SEGMENT
  );
});

test('allow-list accepts dev.azure.com and *.visualstudio.com, rejects others', () => {
  assert.equal(Url.isAllowedHost('dev.azure.com'), true);
  assert.equal(Url.isAllowedHost('contoso.visualstudio.com'), true);
  assert.equal(Url.isAllowedHost('visualstudio.com'), true);
  assert.equal(Url.isAllowedHost('evil.com'), false);
  assert.equal(Url.isAllowedHost('dev.azure.com.evil.com'), false);
  assert.equal(Url.isAllowedHost('notvisualstudio.com'), false);
});

test('a non-https base is rejected', () => {
  assert.throws(
    () => Url.assertAllowedBase('http://dev.azure.com'),
    (e) => e.code === Url.ErrorCodes.INVALID_BASE
  );
});

test('a non-allow-listed https base is rejected', () => {
  assert.throws(
    () => Url.assertAllowedBase('https://evil.com'),
    (e) => e.code === Url.ErrorCodes.INVALID_HOST
  );
});

test('an explicit visualstudio.com organizationUrl is honored and normalized to origin', () => {
  const scope = Object.assign({}, SCOPE, { organizationUrl: 'https://contoso.visualstudio.com/some/path' });
  const req = Url.iterations(scope);
  assert.ok(req.url.startsWith('https://contoso.visualstudio.com/'));
  assert.ok(!req.url.includes('/some/path/'));
});

test('isolation: different orgs/projects/teams produce different URLs', () => {
  const a = Url.iterations(SCOPE).url;
  const b = Url.iterations(Object.assign({}, SCOPE, { organization: 'other-org' })).url;
  const c = Url.iterations(Object.assign({}, SCOPE, { team: 'Beta' })).url;
  assert.notEqual(a, b);
  assert.notEqual(a, c);
  assert.ok(b.includes('/other-org/'));
  assert.ok(c.includes('/Beta/'));
});
