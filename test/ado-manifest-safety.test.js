// test/ado-manifest-safety.test.js
// Guard tests for Manifest V3 compatibility and non-regression of the existing
// DOM + local-storage runtime (T2.1 goal sections 7, 8, 10, 11).
//
// These assert STRUCTURAL safety, not behavior:
//   - the manifest stays Manifest V3 with unchanged host_permissions;
//   - the API integration adds NO new manifest permission (same-origin fetch
//     reuses the existing host_permissions — DATA_ACCESS_SPIKE §2.3);
//   - the API modules are NOT yet wired into the content-script runtime, so with
//     the flag off the DOM runtime (content.js + Daily modules + the R1 observer)
//     is completely undisturbed;
//   - every API module loads with NO `chrome`, `document` or `window` present,
//     proving they cannot crash the page at load and run offline with mocks.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

test('manifest stays Manifest V3', () => {
  assert.equal(manifest.manifest_version, 3);
});

test('host_permissions are unchanged and cover the allow-listed hosts', () => {
  assert.deepEqual(manifest.host_permissions, [
    'https://dev.azure.com/*',
    'https://*.visualstudio.com/*',
  ]);
});

test('no new broad permission was added for the API (only storage)', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
});

test('the API modules are NOT yet wired into the content-script runtime', () => {
  const contentScripts = manifest.content_scripts || [];
  const allJs = contentScripts.reduce(function (acc, cs) {
    return acc.concat(cs.js || []);
  }, []);
  // The flag is off by default and there is no valid auth; the integration must
  // not load into the board page yet (goal: no visible/incomplete controls,
  // Daily stays independent). So no src/api/* file is registered.
  allJs.forEach(function (file) {
    assert.ok(!file.startsWith('src/api/'), 'unexpected API module in content scripts: ' + file);
  });
  // The existing Daily runtime files are still registered (no regression).
  ['content.js', 'src/data/snapshot-store.js', 'src/data/daily-history.js'].forEach(function (file) {
    assert.ok(allJs.includes(file), 'missing expected runtime file: ' + file);
  });
});

test('every API module loads with no chrome/document/window present (MV3/offline safe)', () => {
  // Record and clear any globals a test runner might have leaked.
  const savedChrome = global.chrome;
  const savedDocument = global.document;
  const savedWindow = global.window;
  delete global.chrome;
  delete global.document;
  delete global.window;

  const apiFiles = [
    '../src/api/ado-url.js',
    '../src/api/ado-errors.js',
    '../src/api/ado-contracts.js',
    '../src/api/ado-auth.js',
    '../src/api/ado-feature-flag.js',
    '../src/api/ado-transport.js',
    '../src/api/ado-client.js',
  ];

  try {
    apiFiles.forEach(function (rel) {
      const resolved = require.resolve(rel);
      delete require.cache[resolved]; // force a fresh load in the bare env
      assert.doesNotThrow(function () { require(rel); }, 'module threw at load: ' + rel);
    });
  } finally {
    if (savedChrome !== undefined) global.chrome = savedChrome;
    if (savedDocument !== undefined) global.document = savedDocument;
    if (savedWindow !== undefined) global.window = savedWindow;
  }
});

test('loading the API client does not read chrome storage or issue any request', async () => {
  // Importing and constructing a client must be inert until a method is called
  // (and even then it is gated). Construction with the flag off and an injected
  // fetch that would throw if called proves no request escapes on construction.
  const Client = require('../src/api/ado-client.js');
  let fetchCalled = false;
  const client = Client.createClient({
    fetch: function () { fetchCalled = true; return Promise.resolve({ status: 200, headers: { get: () => null }, json: () => Promise.resolve({}) }); },
    storage: { get: function (keys, cb) { queueMicrotask(function () { cb({}); }); } }, // flag absent => disabled
  });
  // A guarded call with the flag off must reject WITHOUT calling fetch.
  await assert.rejects(() => client.getIterations({ organization: 'o', project: 'p', team: 't' }));
  assert.equal(fetchCalled, false);
});
