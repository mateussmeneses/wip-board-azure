# Product Roadmap — WIP Board Azure evolution

> From WIP monitor to delivery-tracking tool: Daily Commitment, Sprint Intelligence,
> Roadmap Intelligence, History. Tasks are small, prioritized, and each carries
> acceptance criteria and planned tests. No existing feature is removed; WIP semantics
> are unchanged; no credentials enter the repo.

Priority legend: **P0** = structural / risk-reducing, do first · **P1** = first new
value (Daily Commitment) · **P2** = Sprint · **P3** = Roadmap / History.

---

## Phase 0 — Structural hardening (P0, lowest risk)

### T0.1 — Add a test harness (no runtime change)
- Scope: add `package.json` (devDependency: a test runner such as Vitest/Jest) and a
  `test/` folder. No change to extension files.
- Acceptance: `npm test` runs and reports; CI-ready single-run mode works.
- Tests: a trivial smoke test passes.

### T0.2 — Characterization tests for existing pure logic
- Scope: cover `formatMessage`, `normalizeColumnName`, `isConfiguredWipColumn`,
  `getCardSeverityClass`, and the special-person WIP reduction math — as they behave
  **today** (lock current behavior before any refactor).
- Acceptance: tests capture current outputs incl. the special-rule block reduction
  (`total - specialOriginal + specialAdjusted`).
- Tests: table-driven unit tests; must pass against unmodified logic.

### T0.3 — Extract pure helpers to `src/core` (behavior-preserving) — DONE
- Scope: move i18n packs + pure string/number helpers into ordered content-script
  files under one namespace; `content.js` keeps DOM + orchestration.
- Acceptance: extension still loads with no console errors; manual checklist in
  `AGENTS.md` passes; T0.2 tests still green.
- Tests: reuse T0.2 against the extracted modules.
- Status: `content.js` now consumes `WIPBoardCore` (src/core/wip-logic.js) for i18n,
  text normalization, WIP limit math, special-person reduction, target-date math and
  alarm severity. The inline duplicates (`getLanguageCode`, `formatMessage`,
  `normalizeText`, `normalizeColumnName`, `isConfiguredWipColumn`,
  `getCardSeverityClass`, inline limit/reduction/target-date math) were removed.
  `manifest.json` loads the module before `content.js`.

### T0.4 — Normalized work-item model + `board-dom-reader` — DONE
- Scope: a reader that returns `{ id, type, state, column, assignee, aging, targetDate, tags }[]`
  from the board DOM; WIP calc consumes the model instead of scraping inline.
- Acceptance: WIP numbers identical to today on the sample board HTML.
- Tests: parse the committed sample HTML fixture, assert ids and counts.
- Status: `content.js` now consumes `WIPBoardReader` (src/data/board-dom-reader.js)
  for column structure, order, stable column id, card→column mapping and visibility.
  The fragile header/body index pairing and the inline `getHeaderColumnDisplayName` /
  `isCardVisible` helpers were removed. Per-card rule analysis (special tag with the
  serialized-HTML fallback, block tag, aging, target date) still runs on the live DOM
  node, resolved from the model by stable `data-itemid`. Equivalence to the
  pre-integration scan is proven for every WIP scenario by
  `test/wip-runtime-integration.test.js`.

---

## Phase 1 — Daily Commitment (P1, DOM-only MVP)

### T1.1 — `snapshot-store` on `chrome.storage.local`
- Scope: write/read snapshots keyed `board::yyyy-mm-dd`; bounded retention (e.g. 30 days).
- Acceptance: a snapshot persists and reloads; retention prunes old entries.
- Tests: unit tests with a mocked storage.

### T1.2 — Capture daily snapshot of column-per-id
- Scope: once per day per board, record each item id's current column + state.
- Acceptance: re-opening the board same day does not duplicate; next day adds one.
- Tests: date-boundary unit tests.

### T1.3 — Commitment model (expected vs actual)
- Scope: per work item, store `startColumn` and `expectedColumn`; compare to the
  latest snapshot to classify on-track / behind / done.
- Acceptance: classification matches a fixture of planned vs realized columns.
- Tests: table-driven unit tests.

### T1.4 — Visual projection (bilingual panel)
- Scope: a panel section showing planned vs realized; EN/PT strings.
- Acceptance: toggled independently of WIP indicator; WIP number unaffected.
- Tests: i18n key coverage test; manual checklist.

---

## Phase 2 — Sprint Intelligence (P2, needs API)

### T2.1 — `ado-api-client` (read-only, feature-flagged)
- Depends on `DATA_ACCESS_SPIKE.md` section 3 passing on a live tenant.
- Scope: same-origin `fetch` wrapper; iterations + workitemsbatch; graceful fallback.
- Acceptance: with flag off, nothing changes; with flag on + signed in, iterations load.
- Tests: client unit tests with mocked `fetch`; fallback path tested.

### T2.2 — Sprint summary
- Scope: current iteration period, goal, initial scope, completed items, %
  completion across Approved→Closed.
- Acceptance: % matches a fixture of states; metric is labeled as delivery, not WIP.
- Tests: computation unit tests.

---

## Phase 3 — Roadmap Intelligence + History (P3)

### T3.1 — Roadmap links
- Scope: Epics/Features and their sprint-linked deliveries when relations are available.
- Acceptance: renders only when data present; otherwise hidden, no errors.
- Tests: fixture-driven rendering tests.

### T3.2 — History & trends
- Scope: movements, blocks, scope changes via snapshots + `/updates`; trend view.
- Acceptance: timeline reconstructs known transitions from a fixture.
- Tests: reducer unit tests over update events.

---

## Guardrails applied to every task
- Keep WIP metrics separate from delivery metrics.
- Key all delivery data off stable `data-itemid`.
- Scope every indicator by org/project/team/board.
- Bilingual UI (EN/PT); English code comments.
- No commits/pushes without authorization; no credentials in repo.
