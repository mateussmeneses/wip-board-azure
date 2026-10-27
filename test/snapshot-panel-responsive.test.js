// Regression guard for the floating Snapshot / Daily / Sprint panel.
// The layout contract is checked statically; actual browser geometry remains
// part of the final Chrome homologation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'content.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'board.css'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/\./g, '\\.');
  const match = css.match(new RegExp(escaped + '\\s*\\{([^}]*)\\}'));
  assert.ok(match, 'missing CSS rule: ' + selector);
  return match[1];
}

test('snapshot panel is constrained to the viewport and has a column layout', () => {
  const panel = rule('#wip-snapshot-panel');
  assert.match(panel, /position:\s*fixed/);
  assert.match(panel, /max-height:\s*calc\(100dvh\s*-\s*32px\)/);
  assert.match(panel, /max-width:\s*calc\(100vw\s*-\s*32px\)/);
  assert.match(panel, /display:\s*flex/);
  assert.match(panel, /flex-direction:\s*column/);
});

test('toggle stays visible while the body independently scrolls', () => {
  const toggle = rule('#wip-snapshot-toggle');
  const body = rule('#wip-snapshot-body');
  assert.match(toggle, /flex:\s*0\s+0\s+auto/);
  assert.match(body, /flex:\s*1\s+1\s+auto/);
  assert.match(body, /min-height:\s*0/);
  assert.match(body, /overflow-y:\s*auto/);
  assert.match(body, /overscroll-behavior:\s*contain/);
  assert.match(css, /#wip-snapshot-panel\.open\s+#wip-snapshot-body\s*\{\s*display:\s*block/);
});

test('small viewports keep the panel within the visible window', () => {
  assert.match(css, /@media\s*\(max-width:\s*600px\),\s*\(max-height:\s*500px\)/);
  assert.match(css, /max-height:\s*calc\(100dvh\s*-\s*16px\)/);
  assert.match(css, /width:\s*min\(360px,\s*calc\(100vw\s*-\s*16px\)\)/);
});

test('toggle announces its state, and Escape can close the panel', () => {
  assert.match(source, /id="wip-snapshot-toggle"[^>]*aria-controls="wip-snapshot-body"[^>]*aria-expanded="false"/);
  assert.match(source, /toggle\.setAttribute\('aria-expanded', String\(open\)\)/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /setOpen\(false\)/);
  assert.match(source, /toggle\.focus\(\)/);
});
