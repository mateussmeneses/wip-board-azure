# Test Strategy — WIP Board Azure

> The extension currently has no automated tests. Because its core risk is silent
> regression when Azure markup changes or when we refactor, the first job of testing
> is to **lock existing behavior** before any structural change, then grow coverage
> alongside each new module.

---

## 1. Principles

1. **Characterize before you change.** Capture current outputs of pure functions as
   tests first (golden/characterization tests), then refactor under their protection.
2. **Pure logic is unit-tested; DOM reading is fixture-tested.** The committed sample
   board HTML (`elementos estruturados do board.html`) is the DOM fixture.
3. **No live network in tests.** `fetch` is always mocked. The live REST spike is a
   manual, signed-in procedure documented in `DATA_ACCESS_SPIKE.md`, not a CI test.
4. **WIP vs delivery isolation is itself a test.** A regression test asserts that
   enabling delivery modules does not change the WIP number for the same fixture.
5. **Bilingual coverage.** Every user-facing key must exist in both `en` and `pt`.

---

## 2. Tooling

- Runner: a zero-config JS runner (Vitest or Jest) added as a devDependency only.
  It never ships in the extension and does not change MV3 runtime.
- DOM for fixtures: jsdom (bundled with the runner) to parse the sample HTML.
- Single-run mode in CI (`vitest run` / `jest --ci`), never watch mode.

The extension itself keeps **no production dependencies** and **no bundler**.

---

## 3. Test layers

### 3.1 Unit — pure helpers (highest priority, Phase 0)
Target functions (current `content.js`):
- `formatMessage(template, tokens)` — token substitution incl. missing tokens.
- `normalizeText` / `normalizeColumnName` — accents, pipes, whitespace collapse.
- `isConfiguredWipColumn` — exact + inclusive matching tolerance.
- `getCardSeverityClass` — threshold boundaries (warning/high/critical).
- Special-person WIP reduction: `total - specialOriginal + specialAdjusted`.
- Target-date day math (dd/mm/yyyy parsing, overdue, days-left).

### 3.2 Fixture — `board-dom-reader`
- Load the committed sample HTML into jsdom.
- Assert: 73 cards parsed, ids are integers, org=`sda-iatec`, project=`Sda.Arms`,
  state/assignee/aging/target-date extracted for a known id.
- Assert WIP count for a configured column set equals the pre-refactor value.

### 3.3 Integration — storage-backed modules
- `snapshot-store`: mock `chrome.storage.local`; write/read/prune; date keys.
- `config`: mock `chrome.storage.sync`; normalization matches `getBoardContext`.
- `ado-api-client`: mock `fetch`; success, 401 fallback, network-error fallback.

### 3.4 Regression — WIP/delivery isolation
- With the same fixture, compute WIP with delivery modules off and on; assert equal.

---

## 4. Manual validation (kept from AGENTS.md)
Automated tests do not replace the manual checklist in `AGENTS.md` (loads in
`chrome://extensions`, popup saves, language toggle, indicator on configured board,
special rule, block tag, details panel). Run it after structural changes.

For the REST path, run the signed-in spike in `DATA_ACCESS_SPIKE.md` section 3 and
record statuses before enabling any API-dependent module.

---

## 5. Definition of done for a task
- New/changed pure logic has unit tests.
- DOM/store/network code has fixture or mocked tests.
- EN and PT keys both present for any new UI string.
- `npm test` green in single-run mode.
- Manual checklist passes for anything touching the board or popup.
