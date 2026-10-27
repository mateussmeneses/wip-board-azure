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

### T1.5 — Projected Board — DONE
- Scope: from the SAVED commitment + the BASE snapshot, render the EXPECTED
  end-of-day board state (each committed item shown in its destination column) so
  the team can see the projected board during the daily. Read-only projection;
  never mutates Azure DevOps; reuses the commitment engine and the snapshot store.
- Acceptance: the projected view places each committed item in its expected column
  and leaves uncommitted items where they are; WIP number unaffected.
- Tests: projection unit tests (committed vs uncommitted placement, missing items).
- Status: `src/data/projected-board.js` (`WIPBoardProjectedBoard`) is a pure,
  Chrome-free and DOM-free engine. `project(baseSnapshot, commitment, options)`
  takes the SELECTED snapshot as the authoritative baseline and the SAVED
  commitment as the declared destinations, then returns the projected board: per
  column it reports `initialCount`/`projectedCount`/`delta`, the `initialIds` and
  `projectedIds`, and per-item move metadata (origin -> destination). It moves
  ONLY items with an explicit, valid destination column that differs from the
  origin; a destination equal to the origin is a no-op; a destination that is not
  a real board column is reported under `invalidDestinations` and the item stays
  put; a committed id absent from the baseline is reported under
  `unknownCommittedIds` and never materialized. Stable ids are preserved,
  duplicate snapshot/commitment ids collapse, item totals are conserved, and
  inputs are never mutated (a deep-frozen snapshot projects fine). Columns come
  from real board data (snapshot/commitment/explicit order) or are derived from
  the item columns — never hardcoded. A `reliability` verdict flags an incomplete
  snapshot, unknown ids or invalid destinations. The engine reads/writes NO WIP
  number. `content.js` adds a "Projected board (simulation)" sub-section inside
  the existing Daily Snapshot panel with an Initial/Projected toggle (re-renders
  from memory, no recompute), per-column counts and +/- deltas, discreet
  highlight + origin for moved cards, a summary (snapshot cards / commitments /
  planned changes), a reliability warning, and a persistent "simulation only"
  note — all localized EN/PT and written through the `withObserverPaused()` /
  `setIndicatorHtml()` R1 guards. It uses the LATEST snapshot and the ACTIVE
  (latest-revision) commitment of the SAME board scope only; the live board is
  never used to substitute missing snapshot data, and with no commitment an
  informative empty state is shown (no old/foreign plan reused).
  `manifest.json` loads `src/data/projected-board.js` before `content.js`.
  Suite: 178 tests pass (151 prior + 18 in `test/projected-board.test.js` + 4 in
  `test/projected-board-r1.test.js` + 5 in `test/i18n-parity.test.js`).
  Real-browser validation pending (see the checklist in
  `docs/PROJECTED_BOARD_T1_5.md`).

### T1.6 — Daily Comparison UI — DONE
- Scope: a view that shows, per committed item, which commitments were FULFILLED,
  which are PENDING, which went BEYOND the expectation and which lack enough
  information to judge. Reuses `WIPBoardDailyCommitment.compareCommitment`
  (reached / behind / beyond / off-track / missing) and the projected-board
  layout; read-only; never mutates Azure DevOps.
- Acceptance: the comparison view classifies each committed item against a chosen
  later snapshot and summarizes counts per category plus a proven fulfillment
  rate; WIP number unaffected.
- Tests: comparison-view unit tests over fixtures for each category; i18n parity;
  R1 regression for the new UI.
- Status: `src/data/daily-comparison.js` (`WIPBoardDailyComparison`) is a pure,
  Chrome-free and DOM-free PRESENTATION view-model. It REUSES the classification
  engine (`WIPBoardDailyCommitment.compareCommitment`) via dependency injection —
  no second comparison mechanism is created — and adds: (1)
  `selectComparableSnapshots`, which returns only the SAME-board snapshots
  captured STRICTLY AFTER the initial one (newest first), never auto-selecting an
  incompatible or other-board snapshot; (2) `resolvePlan`, which honors an
  explicit commitment REVISION so a historic daily is judged against the plan
  actually declared that day, never silently rewritten by a newer revision; (3)
  `buildComparison`, which classifies each committed item (reached / beyond /
  behind / off-track / missing), reports `startColumn` from the initial snapshot,
  the expected and the observed column, an explanation code for undetermined
  results, the daily metrics, and an honest `reliability` verdict; and (4)
  `filterResults` for the UI's per-category filters. The proven fulfillment rate
  is `((reached + beyond) / committed) * 100`, computed ONLY when a later
  snapshot exists AND the column order is reliable; otherwise it is `null` and
  `rateReliable` is `false` so the UI suppresses a misleading percentage.
  `missing`/`off-track` are surfaced separately as UNDETERMINED, never as proven
  failures. A later snapshot from another board or not strictly after the initial
  is refused (`SNAPSHOT_SCOPE_MISMATCH` / `LATER_SNAPSHOT_NOT_AFTER_INITIAL`).
  `content.js` adds a "Daily Comparison / Comparação da Daily" sub-section inside
  the existing snapshot panel with a later-snapshot picker, the daily date and
  snapshot/commitment times, the metrics summary, a proven-fulfillment indicator
  (percentage + bar, suppressed when unreliable), compact per-item comparison
  cards (initial → expected → observed + status + explanation for undetermined),
  result filters (All / Reached / Beyond / Behind / Off-track / Missing) and a
  reliability line — all localized EN/PT and written through the
  `withObserverPaused()` / `setIndicatorHtml()` R1 guards. A four-way "Daily
  views" navigation (Initial board / Projected board / Actual result / Commitment
  comparison) switches visible sub-sections while preserving the selected
  snapshot/commitment identity; it never recomputes, never re-reads the board,
  never mutates the Projected Board and never touches Azure DevOps. The comparison
  module reads/writes NO WIP number. `manifest.json` loads
  `src/data/daily-comparison.js` before `content.js`. Suite: 201 tests pass (178
  prior + 22 in `test/daily-comparison.test.js` + 1 added T1.6 key-parity check
  in `test/i18n-parity.test.js`). Real-browser validation pending (see the
  checklist in `docs/DAILY_COMPARISON_T1_6.md`).

### T1.7 — Daily History — DONE
- Scope: a read-only historical view over the dailies already recorded for ONE
  board scope. Reconstructs the original plan, the related snapshots and the
  obtained results from persisted records only, without rebuilding history from
  current Azure DevOps state. Lists one row per daily (newest-first, date-range
  filter), shows per-daily indicators and aggregate indicators, a simple HTML/CSS
  evolution chart, and navigates to the existing T1.6 comparison for a selected
  daily.
- Acceptance: the history is computed exclusively from persisted snapshots +
  commitments; the overall proven rate is weighted by commitment count (not an
  average of daily percentages); missing/off-track are reported as undetermined,
  never proven failures; dailies from different org/project/team/board/date and
  different commitment ids are never mixed; multiple dailies on the same day keep
  distinct identities; retention that pruned a referenced snapshot yields an
  honest flagged record, never a fabricated baseline; WIP number unaffected.
- Tests: `test/daily-history.test.js` (25) covering every scenario in the task's
  section 8, plus the T1.7 key-parity check in `test/i18n-parity.test.js`.
- Status: `src/data/daily-history.js` (`WIPBoardDailyHistory`) is a pure,
  Chrome-free and DOM-free AGGREGATION view-model. It REUSES the T1.6 comparison
  view-model (`buildComparison`, `selectComparableSnapshots`) via dependency
  injection — which itself reuses the T1.3 classification engine — so no second
  comparison or metrics engine is created. It adds: reconstruction of one daily
  record per commitment; deterministic selection of the evaluation snapshot from
  PERSISTED data only (`evaluation.laterSnapshotId`, else a bounded inferred
  fallback flagged `evaluationSource: 'inferred'`); preservation of the revision
  in effect at evaluation time (the current revision is never silently
  substituted for the original plan); same-scope assertions on every linked
  snapshot; date-range filtering; newest-first ordering; and commitment-weighted
  aggregate indicators where only reliable records feed the overall rate and
  "no reliable evaluation" is counted apart from "zero commitments". To represent
  several dailies per board correctly, the store schema evolved `1 -> 2` with the
  MINIMAL, additive, non-destructive change: an `evaluation` field on commitments
  (`{ laterSnapshotId, revision, evaluatedAt } | null`), a forward
  `migrateRecord` applied on read (old data reads back as v2 with
  `evaluation: null`), and `recordCommitmentEvaluation` which refuses a call
  without a `laterSnapshotId` and never alters the plan or revision. `content.js`
  adds a "Daily History / Histórico da Daily" sub-section (summary, period
  filter, newest-first list, per-date indicators, a library-free HTML/CSS
  evolution chart, per-record "Open comparison" into the T1.6 view) — shown only
  when the history/comparison/commitment modules are present, localized EN/PT
  (37 `history*` keys), and written through the `setIndicatorHtml()` R1
  diff-guard (same discipline as the T1.6 comparison panel; the panel structure
  itself is mounted inside the existing `withObserverPaused()` phase).
  `manifest.json` loads
  `src/data/daily-history.js` before `content.js`. Suite: 226 tests pass (201
  prior + 25 new in `test/daily-history.test.js`; the T1.7 i18n key-parity check
  was added to `test/i18n-parity.test.js`). Real-browser validation pending (see
  the checklist in `docs/DAILY_HISTORY_T1_7.md`).

> Phase 1 — Daily Commitment core (snapshots → commitment → projection →
> comparison → history) is COMPLETE on the DOM-only / local-storage path. Phase 2
> (Sprint Intelligence) is the recommended next increment; it introduces the
> read-only `ado-api-client` and does NOT depend on T1.7. The API-based History &
> trends task (T3.2 below) remains a later, complementary phase that enriches this
> local history with server-side `/updates` once the API shape is confirmed.

---

## Phase 2 — Sprint Intelligence (P2, needs API)

### T2.1 — `ado-api-client` (read-only, feature-flagged) — DONE (offline)
- Depends on `DATA_ACCESS_SPIKE.md` section 3 passing on a live tenant.
- Scope: same-origin `fetch` wrapper; iterations + workitemsbatch; graceful fallback.
- Acceptance: with flag off, nothing changes; with flag on + signed in, iterations load.
- Tests: client unit tests with mocked `fetch`; fallback path tested.
- Status: implemented under `src/api/` as seven small, injectable modules —
  `ado-url.js` (host-allow-listed, traversal-safe URL builders; only read
  endpoints + the WIQL POST are expressible), `ado-errors.js` (one typed error
  model: status→category, retryability, credential-free safe projection),
  `ado-contracts.js` (pure normalization keeping `System.State` DISTINCT from the
  board column and preserving absent fields as the `UNAVAILABLE` sentinel the
  snapshot store already recognizes), `ado-auth.js` (injectable provider; default
  same-origin session cookie with NO stored token; Entra OAuth left as a seam),
  `ado-transport.js` (injectable `fetch`; read-only method policy; timeout;
  bounded jittered retry/backoff for 429/5xx/network/timeout only — never 401/403/
  404, never infinite), `ado-feature-flag.js` (the single gate: `azureApiEnabled`
  default false; `canMakeRequests` needs BOTH flag on AND available auth;
  fail-safe to disabled), and `ado-client.js` (composition root: scope validation,
  ≤ 200-id batching, id dedupe, current-iteration selection, every method gated).
  With the flag off (default) every method rejects with `DISALLOWED` and issues
  NO fetch, so the DOM runtime and the R1 observer are untouched and no auth error
  can reach the WIP indicator. The integration is wired into NO content script
  yet (no incomplete UI). Read-only is structural: no mutating URL builder, and
  the transport rejects any non-GET except the WIQL query POST. Suite: 318 tests
  pass (228 prior + 90 new across `test/ado-url`, `ado-errors`, `ado-contracts`,
  `ado-auth`, `ado-feature-flag`, `ado-transport`, `ado-client`,
  `ado-manifest-safety`, with mocked fetch/auth/storage; no live network). Live,
  signed-in access to a real tenant is NOT proven (`liveAccessProven = false`);
  it remains gated on the `DATA_ACCESS_SPIKE.md §3` spike. See
  `docs/ADO_API_CLIENT_T2_1.md`.

### T2.2 — Sprint Scope & Goal — DONE (offline / DOM + manual)
- Scope: identify the current sprint (period + goal), record the initially
  planned scope as an immutable baseline, and detect scope changes
  (planned/added/removed/completed/in-progress) with configurable flow
  boundaries. Completion (% Approved→Closed) is the follow-up T2.3.
- Acceptance: scope classification matches a fixture of states; the baseline
  never changes silently with card movement; metrics are labeled delivery, not
  WIP; an unavailable API never presents simulated data as real.
- Tests: computation + persistence unit tests.
- Status: four PURE, Chrome-free, DOM-free modules under `src/data/` —
  `sprint-scope.js` (`WIPBoardSprintScope`: sprint identity normalization with
  the UNAVAILABLE sentinel, inclusive period/day math with a `before/active/
  after/unknown` state, and scope-item building that keeps `System.State`
  SEPARATE from the visual board column and flags Feature/Epic parents),
  `sprint-baseline.js` (`WIPBoardSprintBaseline`: an immutable, deep-frozen
  baseline of the planned ids + their start column/state, and
  `detectScopeChanges` which classifies the current scope against that FIXED
  reference — the baseline is never mutated by movement; the END/START
  boundaries are configurable per board, `System.State` is matched only on an
  explicit `useState` opt-in, and Feature parents are excluded from counts
  unless `countFeatures` is explicitly set),
  `sprint-goal-store.js` (`WIPBoardSprintGoalStore`: chrome.storage.local
  persistence via the same injectable adapter the snapshot store uses — the goal
  is saved with a preserved REVISION history, and the baseline is saved ONCE per
  sprint with a DUPLICATE guard so it cannot change silently; `replaceBaseline`
  is the only, explicit re-baseline path and it archives the prior), and
  `sprint-intelligence.js` (`WIPBoardSprintIntelligence`: the composition
  view-model that resolves the availability state — `disabled / unauthenticated
  / unavailable / manual / api / no-sprint` — and builds the UI model; the three
  unavailable states carry NO fabricated sprint and `dataReal` is false, honoring
  "não representar dados simulados como reais"). `content.js` adds a compact,
  bilingual EN/PT "Sprint Intelligence" sub-section inside the existing snapshot
  panel: it resolves the current scope from the DOM reader, accepts a MANUAL
  sprint persisted locally (so planning works with the API off), records the
  baseline, shows the sprint identity/period/days/planned-vs-added counts and an
  explicit availability banner, and lets the user edit + save the goal (objective
  / description / success criteria / priorities) with the revision history
  preserved. Every DOM write goes through `setIndicatorHtml()` and the section is
  mounted inside the existing `withObserverPaused()` phase, so the R1 observer
  fix holds. The read-only `ado-api-client` (T2.1) is intentionally NOT wired
  into the content script in this task (goal section 8: live access unproven, and
  the `ado-manifest-safety` guard keeps `src/api/*` out of the content scripts);
  the view-model already accepts an `apiIteration` so a later, proven API wiring
  drops in without a redesign. `manifest.json` loads the four sprint modules
  before `content.js`. Suite: 375 tests pass (327 prior + 47 new across
  `test/sprint-scope.test.js`, `test/sprint-baseline.test.js`,
  `test/sprint-goal-store.test.js`, `test/sprint-intelligence.test.js` + 1 added
  T2.2 i18n key-parity check). New config keys (all optional, read-only):
  `azureApiEnabled` (existing flag, default false), `sprintStartColumn`,
  `sprintEndColumn`. Real-browser validation and live API access remain pending
  per the homologation policy (goal section 8). See `docs/SPRINT_SCOPE_T2_2.md`.

### T2.3 — Sprint Progress — DONE (offline / DOM + manual)
- Scope: compute and visualize sprint progress against the immutable planned
  baseline, the configurable flow columns and the scope changes. Answers:
  planned / completed / completion % / in progress / added / removed / original
  planning progress / current-scope progress / insufficient-evidence data.
- Acceptance: Baseline Completion % = completed baseline items reaching the END
  column / total baseline × 100; additions and removals are counted SEPARATELY
  and never change the baseline %; a removed item keeps its baseline commitment
  and is identified explicitly; no work item is double-counted; current-scope
  progress is a DISTINCT secondary metric; `System.State = Closed` is NOT treated
  as the last board column; an undeterminable column is UNKNOWN, never assumed
  done; the baseline is never recomputed from the current state; a late first
  capture is flagged; the filtered WIP is never used as the sprint denominator.
- Tests: `test/sprint-progress.test.js` (25) covering empty sprint, 20/12
  baseline → 60%, additions, removals, completion of an added item, a removed
  item before completion, all/none completed, unknown data, configurable +
  renamed start/end columns, State vs Board column, duplicate ids, parent/child
  in the same sprint, different org/team/project inputs, late baseline,
  incomplete snapshot, API disabled, scope changes preserving the baseline; plus
  the T2.3 i18n key-parity check in `test/i18n-parity.test.js`.
- Status: one PURE, Chrome-free, DOM-free module `src/data/sprint-progress.js`
  (`WIPBoardSprintProgress`). It REUSES the T2.2 engines — it calls
  `WIPBoardSprintScope.buildScopeItems` (id dedupe, state/column separation,
  Feature flag) and `WIPBoardSprintBaseline.detectScopeChanges` / `resolveFlow` /
  `sameColumn` (configurable flow boundaries, Feature exclusion report) — and
  never reimplements the scope or persistence algorithms (goal section 1). On
  top it derives the exhaustive six-state model the task mandates
  (`not-started` / `in-progress` / `completed` / `added-after-baseline` /
  `removed-from-scope` / `unknown`): where the T2.2 detector folds an
  undeterminable position into `inProgress`, this engine separates it as
  `unknown` so a percentage is never presented as a complete evaluation. The
  PRIMARY metric is Baseline Completion % (completed baseline items / baseline
  total); a SEPARATE secondary block reports current-scope size, its completion
  %, additions, additions completed and the signed scope delta — the two are
  never mixed (goal sections 2 & 3). A reliability verdict
  (`sufficient` / `partial` / `unavailable`) and a `lateBaseline` flag keep the
  output honest (goal sections 6 & 8). Hierarchy counting is a single backlog
  level: Feature/Epic parents are excluded by default (reusing the `countFeatures`
  flow flag) and reported, so a parent is never counted as an independent
  delivery alongside its children (goal section 5). `content.js` adds a "Sprint
  progress / Progresso da sprint" sub-section INSIDE the existing Sprint
  Intelligence block: an emphasized primary baseline-completion bar + counts, a
  distinct secondary current-scope block, a per-column/stage distribution, a late
  baseline banner and a reliability line — all bilingual EN/PT (26 `progress*`
  keys) and written through the `setIndicatorHtml()` R1 diff-guard inside the
  existing `withObserverPaused()` phase. The read-only API stays unwired (T2.1 +
  goal section 8); progress is computed from the local immutable baseline + the
  DOM scope + the manual sprint. `manifest.json` loads
  `src/data/sprint-progress.js` before `content.js`. Suite: 401 tests pass (375
  prior + 25 new + 1 T2.3 i18n key-parity check). No new config keys; no new
  permission; Manifest V3 preserved. Real-browser validation and live API access
  remain pending per the homologation policy. See `docs/SPRINT_PROGRESS_T2_3.md`.

### T2.4 — Sprint Trends & Risk Analysis — DONE (offline / DOM + manual)
- Scope: temporal analysis of the sprint over successive, persisted
  observations. Answers: progress evolution over time; observed progress vs
  elapsed time (calendar days, with a linear reference line); scope-change
  evolution; remaining work (burndown) and done work (burnup); delivery trends;
  data-grounded risk signals; and the limitations/reliability of each analysis.
  Roadmap Intelligence is explicitly NOT in scope here.
- Acceptance: the time series has one point PER REAL OBSERVATION (never a
  fabricated daily point); the elapsed-time percentage is calendar-day based and
  labelled `calendar-days` to distinguish it from a future business-day metric;
  the linear reference is a visualization aid, never a forecast, and the
  deviation is information, not proof of delay; burnup/burndown use only real
  instants and are NOT forced monotonic (a reopened item lowers completed);
  unknown-state items are a separate series, never counted as done; scope changes
  are labelled "detected in interval" between two captures, never at an exact
  instant; the risk verdict is a heuristic (On Track / Attention / At Risk /
  Insufficient Data) from explicit, configurable, documented thresholds, with the
  contributing signals listed and no statistical/AI claim; thin, late or
  incomplete data prefers Insufficient Data; the baseline is never mutated and the
  DOM is never used to reconstruct past states.
- Tests: `test/sprint-trends.test.js` (24) covering empty history, no baseline, a
  single observation, multiple + out-of-order + duplicate observations, below /
  above / at the time reference, no reliable dates, scope add/remove/return,
  reopened items (non-monotonic series), unknown states, high unknown share
  (insufficient data), scope growth, stagnation, incomplete observations, late
  baseline, a changed finish date, different sprints/orgs, configurable
  thresholds, the goal's 70% elapsed example and the calendar-days basis;
  `test/sprint-observation-store.test.js` (14) covering append + immutability,
  chronological + out-of-order ordering, latest, scope/sprint isolation, timezone
  preservation, completeness/reliability indicators, baseline-ref (never
  persisting the baseline), duplicate collapse, persistence after reload,
  retention pruning, invalid input, the STORAGE_FAILURE path and by-id lookup;
  plus the T2.4 i18n key-parity check in `test/i18n-parity.test.js`.
- Status: one PURE, Chrome-free, DOM-free engine `src/data/sprint-trends.js`
  (`WIPBoardSprintTrends`) and one minimal persistence contract
  `src/data/sprint-observation-store.js` (`WIPBoardSprintObservationStore`). The
  engine REUSES the T2.3 `WIPBoardSprintProgress.computeProgress` per observation
  (it never reimplements the T2.3 classification) and reads the immutable
  baseline read-only. The observation store mirrors the snapshot-store /
  sprint-goal-store design exactly (same injectable adapter, scope+sprint key
  isolation, immutable append-only records, STORAGE_FAILURE surfacing) and stores
  only ids/columns/states/timestamps plus completeness + a baseline REFERENCE —
  never the baseline itself and never credentials. Capture is an EXPLICIT user
  action ("Record observation") reusing the existing `SnapshotCapture` verdict;
  there is no background schedule. `content.js` adds a "Sprint trends & risk /
  Tendências e risco da sprint" sub-section INSIDE the Sprint Intelligence block
  with a three-way view toggle (Progress / Scope / Trends): a progress-vs-time
  view with the linear reference marker and the signed deviation; a trends view
  with the completion series, the burnup/burndown points and the colored risk
  badge + signal explanation; and a scope-change timeline — all bilingual EN/PT
  (49 `trends*` keys) and written through the `setIndicatorHtml()` R1 diff-guard
  inside the existing `withObserverPaused()` phase. The read-only API stays
  unwired (T2.1 + goal section 12); trends are computed from the local immutable
  baseline + the persisted observation history + the manual/DOM sprint.
  `manifest.json` loads both modules before `content.js`. Suite: 438 tests pass
  (401 prior + 36 new + 1 T2.4 i18n key-parity check). No new config keys; no new
  permission; Manifest V3 preserved; WIP, R1 and Daily Intelligence regressions
  all green. Real-browser validation and live API access remain pending per the
  homologation policy. See `docs/SPRINT_TRENDS_T2_4.md`.

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
