// test/helpers/mini-dom.js
// A tiny, zero-dependency HTML parser + DOM shim for tests only.
//
// Why this exists: the extension ships with no dependencies and the test runner
// is Node's built-in `node --test`. Pulling in jsdom just to parse fixture HTML
// would add a heavy devDependency the project explicitly wants to avoid. This
// shim implements only the minimal DOM surface the board-dom-reader relies on:
//   - element.querySelector / querySelectorAll
//   - element.getAttribute
//   - element.textContent
//   - element.closest
//   - a getComputedStyle-compatible hook (via the reader's injectable isVisible)
//
// Supported CSS selector grammar (intentionally small):
//   - tag            e.g. span, a
//   - .class         e.g. .wit-card
//   - tag.class      e.g. a.title
//   - [attr]         e.g. [data-itemid]
//   - [attr*="v"]    e.g. [href*="/_workitems/edit/"]
//   - [attr="v"]     e.g. [aria-hidden="true"]
//   - comma groups   e.g. [aria-hidden="true"], .is-hidden, .hidden
//   - descendant     e.g. .value .text-ellipsis
//
// This is NOT a general-purpose DOM. It is deliberately scoped to the reader.
// All comments are in English per project guidelines.

'use strict';

// --- Tokenizer / parser ------------------------------------------------------

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

class El {
  constructor(tag) {
    this.tagName = (tag || '').toUpperCase();
    this.attributes = Object.create(null);
    this.children = [];
    this.parent = null;
    this._text = '';
    this.ownerDocument = null;
  }

  getAttribute(name) {
    const v = this.attributes[name];
    return v === undefined ? null : v;
  }

  get classList() {
    const cls = (this.attributes['class'] || '').split(/\s+/).filter(Boolean);
    return {
      contains: (c) => cls.indexOf(c) !== -1,
    };
  }

  get textContent() {
    if (this.children.length === 0) return this._text;
    let out = this._text;
    for (const child of this.children) {
      out += child.textContent;
    }
    return out;
  }

  _descendants() {
    const out = [];
    const stack = [...this.children];
    while (stack.length) {
      const node = stack.shift();
      out.push(node);
      if (node.children.length) stack.unshift(...node.children);
    }
    return out;
  }

  matches(selector) {
    return matchesSimple(this, parseSimple(selector.trim()));
  }

  querySelectorAll(selector) {
    const groups = selector.split(',').map((s) => s.trim()).filter(Boolean);
    const result = [];
    const seen = new Set();
    for (const group of groups) {
      for (const el of this._matchGroup(group)) {
        if (!seen.has(el)) {
          seen.add(el);
          result.push(el);
        }
      }
    }
    return result;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length ? all[0] : null;
  }

  // Match a single compound/descendant selector (space-separated simple parts).
  _matchGroup(group) {
    const parts = group.split(/\s+/).filter(Boolean).map(parseSimple);
    // Start from all descendants matching the first part, then narrow.
    let candidates = this._descendants().filter((el) => matchesSimple(el, parts[0]));
    for (let i = 1; i < parts.length; i++) {
      const next = [];
      for (const cand of candidates) {
        for (const d of cand._descendants()) {
          if (matchesSimple(d, parts[i])) next.push(d);
        }
      }
      candidates = next;
    }
    return candidates;
  }

  closest(selector) {
    const groups = selector.split(',').map((s) => s.trim()).filter(Boolean).map(parseSimple);
    let node = this;
    while (node) {
      if (groups.some((g) => matchesSimple(node, g))) return node;
      node = node.parent;
    }
    return null;
  }

  getClientRects() {
    // Shim default: present. Visibility in tests is controlled by the reader's
    // injectable isVisible predicate, not by this method.
    return [{}];
  }
}

// Parse a simple selector into { tag, class, attr, attrVal, attrOp }.
function parseSimple(sel) {
  const parsed = { tag: null, cls: null, attr: null, attrVal: null, attrOp: null };
  let rest = sel;

  const attrMatch = rest.match(/\[([^\]]+)\]/);
  if (attrMatch) {
    const inner = attrMatch[1];
    const eq = inner.match(/^([^*=]+)(\*?)=?"?([^"]*)"?$/);
    if (eq) {
      parsed.attr = eq[1];
      parsed.attrOp = eq[2] === '*' ? '*=' : (inner.indexOf('=') !== -1 ? '=' : null);
      parsed.attrVal = inner.indexOf('=') !== -1 ? eq[3] : null;
    } else {
      parsed.attr = inner;
    }
    rest = rest.replace(attrMatch[0], '');
  }

  const clsMatch = rest.match(/\.([A-Za-z0-9_-]+)/);
  if (clsMatch) {
    parsed.cls = clsMatch[1];
    rest = rest.replace(clsMatch[0], '');
  }

  if (rest.trim()) parsed.tag = rest.trim().toUpperCase();
  return parsed;
}

function matchesSimple(el, p) {
  if (!el || el.tagName === undefined) return false;
  if (p.tag && el.tagName !== p.tag) return false;
  if (p.cls && !el.classList.contains(p.cls)) return false;
  if (p.attr) {
    const val = el.getAttribute(p.attr);
    if (val === null) return false;
    if (p.attrOp === '=' && val !== p.attrVal) return false;
    if (p.attrOp === '*=' && val.indexOf(p.attrVal) === -1) return false;
  }
  return true;
}

// --- HTML parser (small, forgiving) ------------------------------------------

function parseHTML(html) {
  const doc = new El('#document');
  doc.ownerDocument = doc;
  doc.defaultView = { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) };

  const stack = [doc];
  const tagRe = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^>]*?)?)\/?>|([^<]+)/g;
  let m;

  while ((m = tagRe.exec(html)) !== null) {
    const full = m[0];

    if (m[3] !== undefined) {
      // Text node content.
      const parent = stack[stack.length - 1];
      const decoded = decodeEntities(m[3]);
      // Attach text to the nearest element: fold into its own _text if it has no
      // element children yet, otherwise create a text-bearing synthetic element.
      appendText(parent, decoded);
      continue;
    }

    const tag = m[1].toLowerCase();
    const isClose = full[1] === '/';

    if (isClose) {
      // Pop until matching tag.
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tagName === tag.toUpperCase()) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const el = new El(tag);
    el.ownerDocument = doc;
    el.attributes = parseAttributes(m[2] || '');
    const parent = stack[stack.length - 1];
    el.parent = parent;
    parent.children.push(el);

    const selfClosing = full.endsWith('/>') || VOID_TAGS.has(tag);
    if (!selfClosing) stack.push(el);
  }

  return doc;
}

// Represent text as leaf synthetic nodes so textContent concatenation preserves
// order relative to element children.
function appendText(parent, textValue) {
  if (!textValue) return;
  if (parent.children.length === 0) {
    parent._text += textValue;
    return;
  }
  const textNode = new El('#text');
  textNode._text = textValue;
  textNode.ownerDocument = parent.ownerDocument;
  textNode.parent = parent;
  textNode._descendants = () => [];
  // #text nodes never match selectors (no tag/class/attr on them in practice).
  parent.children.push(textNode);
}

function parseAttributes(str) {
  const attrs = Object.create(null);
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-a-zA-Z0-9_:.]*)/g;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m[1] !== undefined) {
      attrs[m[1]] = decodeEntities(m[2]);
    } else if (m[3] !== undefined) {
      attrs[m[3]] = '';
    }
  }
  return attrs;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

module.exports = { parseHTML };
