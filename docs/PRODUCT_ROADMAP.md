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

### T0.5 — Runtime stability: fix R1 observer loop + module resilience — DONE
- Scope: resolve risk R1 (MutationObserver self-retrigger) and harden the module
  wiring so a missing/broken `WIPBoardCore`/`WIPBoardReader` cannot silently read as
  an empty board. No WIP-semantics change; observer config unchanged; MV3 preserved.
- Acceptance: a single external board change triggers exactly one recompute; an idle
  board triggers none; a missing module surfaces a diagnostic instead of WIP = 0; all
  automated tests pass.
- Tests: `test/mutation-observer-r1.test.js` (rewritten BEFORE/AFTER) and
  `test/runtime-stability.test.js` (single/multiple moves, config change, indicator
  render, self-induced mutations, empty board, reload, missing modules).
- Status: `content.js` wraps the write phase (`applyCardAlarm` loop + `displayWip`) in
  `withObserverPaused()` (disconnect → write → reconnect on the next microtask) and
  routes every indicator write through `setIndicatorHtml()` (diff-before-write).
  `assertRequiredModules()` + a hardened `readBoardModel()` fail loud with a red
  diagnostic indicator instead of a silent zero. Suite: 62 tests pass.

---

## Phase 1 — Daily Commitment (P1, DOM-only MVP)

### T1.1 — `snapshot-store` on `chrome.storage.local` — DONE
- Scope: write/read snapshots keyed by org/project/team/board + id; bounded
  retention (count-based and optional age-based).
- Acceptance: a snapshot persists and reloads; retention prunes old entries.
- Tests: unit tests with a mocked storage.
- Status: `src/data/snapshot-store.js` persists two distinct record kinds on
  `chrome.storage.local` via an injectable adapter — immutable (deep-frozen)
  **snapshots** of observed board state and mutable **commitments** that carry a
  revision history. Keys embed the full org/project/team/board scope so data
  from different teams/boards cannot collide. `capturedAt` preserves the UTC
  instant, the timezone offset and a local calendar day. The comparison engine
  (`diffStates`) is a pure, Chrome-free function: items absent from a later state
  are reported as `missing`, never silently treated as "done" (reliability rule),
  and a planned-vs-observed classification (`on-track`/`behind`/`missing`) is
  produced when an expected-column resolver is supplied. Only non-sensitive
  fields (id, column, state, assignee display name, type) are stored — no tokens,
  cookies, credentials or raw HTML. Schema is versioned (`SCHEMA_VERSION`) with a
  forward `migrateRecord` hook applied on read. Retention is configurable
  (`maxSnapshotsPerBoard`, `maxCommitmentsPerBoard`, `maxAgeDays`) and `purge`
  supports day-based and full-scope deletion. The runtime (`content.js`,
  `manifest.json`) is intentionally NOT modified in this task; the module ships
  behind no UI yet. Suite: `test/snapshot-store.test.js` (26 tests) green; full
  suite 88 tests pass. Mock: `test/helpers/mock-chrome-storage.js` (zero deps).

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
