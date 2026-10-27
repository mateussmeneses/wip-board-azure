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

### T1.2 — Capture daily snapshot of column-per-id — DONE
- Scope: record each item id's current column + state on explicit user action.
- Acceptance: a capture persists and reloads; history lists prior captures;
  different boards stay isolated; captures at different times are both kept.
- Tests: fixture-driven capture + persistence unit tests.
- Status: `src/data/snapshot-capture.js` (`WIPBoardSnapshotCapture`) is a pure,
  Chrome-free and DOM-free bridge from the `WIPBoardReader` model to the
  `WIPBoardSnapshotStore`. It captures ALL board columns (not only WIP-configured
  ones), labels terminal/done columns from the board's own `data-done` flag (no
  hardcoded names; an optional keyword list recognizes the "approved"/start-of-flow
  role), preserves stable ids and available metadata, and emits an honest
  completeness verdict — empty board, hidden/filtered cards, duplicate ids and
  missing ids each flag the capture `incomplete` so it is never silently saved as
  complete. The store now persists an optional per-column structure (id, name,
  order, role, isDoneColumn, count) alongside the item list so history can show
  work-item counts per column. `content.js` adds a discrete, collapsible
  bottom-right panel (§1d) with three explicit actions — Capture snapshot, View
  last snapshot, View history — plus success/failure messages, all localized
  EN/PT. Capture runs ONLY on a button click: it is read-only (never edits a work
  item), never triggered by a DOM mutation, and the panel is mounted inside the
  existing `withObserverPaused()` write phase so it adds no MutationObserver
  cycle. Local storage is labeled as not shared with the team. Suite: 109 tests
  pass (88 prior + 21 new in `test/snapshot-capture.test.js`). The daily
  dedup/"one per day" rule and automatic daily commitment comparison are
  intentionally deferred to T1.3.
- Pending real-browser validation: see the Chrome checklist in
  `docs/DAILY_SNAPSHOT_T1_2.md` (not yet executed in a live Chrome against a real
  Azure DevOps board).

### T1.3 — Commitment model (expected vs actual) — DONE
- Scope: per work item, store `startColumn` and `expectedColumn`; compare to the
  latest snapshot to classify on-track / behind / done.
- Acceptance: classification matches a fixture of planned vs realized columns.
- Tests: table-driven unit tests.
- Status: `src/data/daily-commitment.js` (`WIPBoardDailyCommitment`) is a pure,
  Chrome-free and DOM-free engine. `buildCommitmentItems(baseSnapshot, expectations)`
  derives, per stable id, the `startColumn` (from the base snapshot) and the
  `expectedColumn` (the planned destination), emitting exactly the item shape the
  existing `WIPBoardSnapshotStore.saveCommitment` / `reviseCommitment` expect — no
  new store is introduced; the versioned-commitment persistence already present is
  reused. `compareCommitment(commitment, realizedState, options)` classifies each
  committed item as `reached` / `behind` / `beyond` / `off-track` / `missing`:
  `behind` vs `beyond` uses the flow ORDER of columns (from the realized state's
  `columns` structure or an explicit `columnOrder`), and when the order cannot be
  resolved it stays the conservative `off-track` rather than guessing a direction.
  An item absent from the realized state is reported `missing`, never inferred as
  delivered (reliability rule shared with the store's `diffStates`). Items without
  a commitment are never part of the comparison. Delivery metrics are kept fully
  separate from WIP (nothing here reads or writes a WIP number). Suite: 128 tests
  pass (109 prior + 19 new in `test/daily-commitment.test.js`).
- Pending real-browser validation: see the Chrome checklist in
  `docs/DAILY_COMMITMENT_T1_3.md` (not yet executed in a live Chrome).

### T1.4 — Visual projection + Card Picker (bilingual panel) — DONE
- Scope: a panel section showing planned vs realized; EN/PT strings. Extended to
  replace the manual `id: column` textarea with a VISUAL work-item card picker.
- Acceptance: toggled independently of WIP indicator; WIP number unaffected; the
  destination column dropdown reflects the board's real columns; selection,
  persistence, revisions and comparison all work from the picker.
- Tests: i18n key coverage test; picker view-model unit tests; R1 regression for
  the new UI; manual checklist.
- Status (initial, kept for history): `content.js` first shipped a "Daily
  commitment (plan vs actual)" sub-section INSIDE the existing Daily Snapshot
  panel using a lightweight `id: column` textarea, persisting a versioned
  commitment and projecting plan vs actual with per-item badges + summary, all
  bilingual EN/PT, mounted inside `withObserverPaused()` and writing through the
  `setIndicatorHtml` diff-guard.
- Status (Card Picker increment): the textarea is replaced by a visual selection.
  A new pure view-model `src/data/commitment-picker.js`
  (`WIPBoardCommitmentPicker`) merges the base snapshot (authoritative committable
  ids + `startColumn` at planning time), the live board model (title / current
  column / assignee for display) and any saved commitment (pre-selection for
  consult/edit), builds the destination-column options from the board's REAL
  columns in flow order, filters rows by id/title search, and converts the
  checkbox+dropdown selection back into the exact expectations map the T1.3 engine
  (`WIPBoardDailyCommitment.buildCommitmentItems`) consumes — the snapshot store,
  commitment engine and comparison rules are REUSED, not reimplemented. The panel
  now renders a searchable list with a checkbox, id+title, assignee, current
  column and a per-card destination dropdown, plus a live plan summary, Save,
  "Choose work items" and "Plan vs actual" actions. A selection without a chosen
  destination is rejected (destination must be explicit); duplicate ids are
  collapsed; an item present on the base snapshot but gone from the live board is
  still offered and flagged off-board (never assumed done). Every picker DOM write
  (list render on each keystroke/toggle, summary) runs inside `withObserverPaused()`
  and the summary is diff-guarded, so the R1 fix is preserved for the new,
  write-heavy UI. Board-derived text is HTML-escaped before it reaches innerHTML.
  `manifest.json` loads `src/data/commitment-picker.js` before `content.js`.
  Suite: 151 tests pass (128 prior + 20 in `test/commitment-picker.test.js` + 3 in
  `test/commitment-picker-r1.test.js`). Real-browser validation pending (see the
  checklist in `docs/DAILY_COMMITMENT_T1_4.md`).

### T1.5 — Projected Board (next increment, planned)
- Scope: from the saved commitment + the live board, render the EXPECTED end-of-day
  board state (each committed item shown in its destination column) so the team can
  see the projected board during the daily. Read-only projection; never mutates
  Azure DevOps; reuses the picker view-model and the commitment engine.
- Acceptance: the projected view places each committed item in its expected column
  and leaves uncommitted items where they are; WIP number unaffected.
- Tests: projection unit tests (committed vs uncommitted placement, missing items).

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
