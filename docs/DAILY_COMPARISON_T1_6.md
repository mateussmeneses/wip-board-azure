# Daily Comparison UI — T1.6

> Status: implemented (automated tests green, 201 pass). Real-browser validation
> against a live Azure DevOps board is still PENDING (see the Chrome checklist
> below).
>
> Code comments stay in English. User-facing strings stay bilingual (EN / PT-BR).
> No existing feature is removed and WIP rule semantics are preserved. No commits
> or pushes were made by this task.

---

## 1. What this adds

A read-only comparison between the daily PLAN and a LATER observed snapshot of
the SAME board. It answers:

- What did we plan to deliver?
- What did we actually deliver?
- Which commitments were fulfilled, which are pending, which went beyond the plan?
- Which have no sufficient evidence to judge?
- What was the proven fulfillment rate?

The comparison NEVER changes Azure DevOps and never moves a work item. It is math
over stored snapshots and a stored commitment.

---

## 2. Reuse of the existing architecture (no second mechanism)

The classification itself is NOT reimplemented. `compareCommitment`
(`src/data/daily-commitment.js`, T1.3) already produces the per-item verdicts
(`reached` / `behind` / `beyond` / `off-track` / `missing`). T1.6 reuses it.

| Reused component | Role in T1.6 |
|---|---|
| `WIPBoardSnapshotStore` | Reads the initial snapshot, the later snapshots and the commitment (same board scope). No new store. |
| `WIPBoardReader` | Resolves the board scope (org/project/team/board) as in the other panel actions. |
| Daily Commitment engine (`compareCommitment`) | The single source of the reached/behind/beyond/off-track/missing classification. Injected into the view-model. |
| Commitment Picker | The commitment under comparison is the one saved through the picker (T1.4). |
| Projected Board engine | Reused by the Initial / Projected daily-views navigation; the comparison does not alter it. |

The new module `src/data/daily-comparison.js` (`WIPBoardDailyComparison`) is a
pure, Chrome-free and DOM-free PRESENTATION view-model. It adds only the parts
`compareCommitment` does not cover: snapshot selection, revision resolution,
daily metrics + the proven fulfillment rate, reliability verdict, explanations
and result filters.

---

## 3. Data selection (requirement 2)

The comparison uses:

- the SELECTED initial snapshot (authoritative planning baseline),
- the commitment for that board, with an applicable REVISION,
- a SELECTED later snapshot chosen among the records available for the SAME board,
- the org/project/team/board identity, and
- a valid column order.

Rules enforced:

- The later snapshot's capture time must be STRICTLY GREATER than the initial
  snapshot's (`LATER_SNAPSHOT_NOT_AFTER_INITIAL` otherwise).
- A snapshot from another board is never offered and is refused if forced
  (`SNAPSHOT_SCOPE_MISMATCH`).
- `selectComparableSnapshots(candidates, initial)` returns only same-board
  snapshots after the initial one, newest first; it never auto-selects an
  incompatible one.
- The commitment is shown with its version (revision), date and time.
- A historic daily is judged against the plan actually declared that day:
  `resolvePlan(commitment, revision)` reads the archived revision verbatim and
  flags `usedArchived`. A newer revision is never silently substituted.

---

## 4. Classification (requirement 3)

Delegated to `compareCommitment`, surfaced per item with the start column (from
the initial snapshot), the expected column and the observed column:

| Status | Meaning |
|---|---|
| `reached` | The item is exactly in its expected column. |
| `beyond` | The item moved past the expected column, with a reliable flow order. |
| `behind` | The item is still before the expected column, with a reliable flow order. |
| `off-track` | Progress cannot be established safely (unknown direction or incompatible flow). |
| `missing` | The item is not in the later snapshot; no sufficient evidence to judge. |

A missing card is never interpreted as delivered. Direction is never inferred
without a valid column order (then the result stays `off-track`).

---

## 5. Metrics (requirement 4)

`buildComparison` returns a `metrics` object:

- `committed` — total planned commitments.
- `reached`, `beyond`, `behind`, `offTrack`, `missing` — per-category totals.
- `fulfilled` = `reached + beyond` (proven delivered).
- `undetermined` = `offTrack + missing` (NOT proven failures; reported apart).
- `fulfillmentRate` = `((reached + beyond) / committed) * 100`, one decimal.
- `rateReliable` — `true` only when a later snapshot exists, the column order is
  reliable and there is at least one commitment.

When `rateReliable` is `false`, `fulfillmentRate` is `null` and the UI shows the
counts but suppresses the percentage so it is never misleading. The metrics are
entirely separate from the WIP calculation (the module reads/writes no WIP
number).

---

## 6. UI (requirement 5) and navigation (requirement 6)

Inside the existing `#wip-snapshot-panel`:

- A "Daily Comparison / Comparação da Daily" sub-section with:
  - a later-snapshot picker (same board, after the initial);
  - the daily date, the initial and later snapshot times, the commitment revision
    and time, and a note when a historic revision is being compared;
  - the metrics summary and a separate "undetermined" line;
  - a proven-fulfillment indicator (percentage + progress bar) or an explicit
    "unavailable" line when the data is insufficient/unreliable;
  - a reliability line listing the limitations;
  - result filters: All / Reached / Beyond / Behind / Off-track / Missing;
  - compact comparison cards showing initial → expected → observed column, the
    status badge and, for undetermined results, a localized explanation.
- A four-way "Daily views" navigation: Initial board, Projected board, Actual
  result, Commitment comparison. Switching a view preserves the selected
  snapshot/commitment identity, does not recompute, does not re-read the board,
  does not alter the Projected Board and does not touch Azure DevOps.

All strings are localized EN/PT. The Kanban is not recreated; the comparison uses
compact cards and reuses the existing panel chrome and the `withObserverPaused()`
/ `setIndicatorHtml()` R1 primitives.

---

## 7. Reliability and integrity (requirement 7)

Handled explicitly:

- Incomplete snapshot (initial and/or later) → flagged in `reliability.reasons`.
- Missing item → `missing`, never inferred as delivered.
- Nonexistent / renamed column → normalized (accent/case tolerant) via the
  engine; an unmatched column yields `off-track`, never a guessed direction.
- Duplicate id → collapsed to the first by the engine/store.
- Incompatible date / other board → the later snapshot is refused.
- Commitment without a valid snapshot → explicit "no base" / "no commitment"
  states.
- Commitment revision → the applicable revision is resolved; a missing requested
  revision falls back to the current plan and reports it.
- Storage failures → surfaced through the store's `STORAGE_FAILURE` and shown as
  an error state in the panel.
- The UI shows loading, empty and error states. No result is invented when the
  information is unavailable.

---

## 8. Tests

- `test/daily-comparison.test.js` (22): fully fulfilled; partially fulfilled; all
  behind; beyond; missing; normalized columns; unknown order → off-track +
  suppressed rate; explicit `columnOrder` restores reliability; incomplete later
  and incomplete initial snapshots flagged; no later snapshot; scope mismatch and
  not-after-initial refusals; `selectComparableSnapshots` isolation + ordering;
  commitment revision vs. current plan; end-to-end through the real store with
  org/project/board isolation and persistence; fulfillment-rate formula; result
  filters; reuse of the injected engine (one `compareCommitment` call);
  module hygiene (no DOM, no Chrome, no innerHTML, no WIP number); uncommitted
  items excluded; start column from the initial snapshot.
- `test/i18n-parity.test.js` (+1): the T1.6 keys exist in both EN and PT; whole
  I18N pack parity, placeholder-token parity and no-empty-string invariants cover
  the new strings.

Full suite: **201 tests pass** (178 prior + 22 new + 1 added parity check).

Regression evidence (run explicitly, 56/56 pass): `mutation-observer-r1`,
`projected-board-r1`, `commitment-picker-r1`, `wip-logic`,
`wip-runtime-integration`, `runtime-stability`, `i18n-parity`.

---

## 9. Demonstration with fictional data

Initial snapshot (morning), flow `Approved → Desenvolvimento → Code Review → HO →
Closed`:

```
Approved:         #1 #2 #3 #4
```

Commitment (all four to `Code Review`). Later snapshot (afternoon):

```
Code Review:      #1 #2        (reached)
Desenvolvimento:  #3           (behind)
Closed:           #4           (beyond)
```

Result:

- reached 2, beyond 1, behind 1, off-track 0, missing 0.
- fulfilled = reached + beyond = 3; committed = 4.
- proven fulfillment rate = (3 / 4) × 100 = **75.0%** (reliable: later snapshot
  present + reliable column order).

If the later snapshot had no column structure and no explicit order, `#3` and
`#4` would be `off-track`, and the rate would be reported as **unavailable** with
the reason "unreliable column order".

---

## 10. Risks and limitations (for final homologation)

- The panel compares the LATEST captured snapshot as the initial baseline against
  a chosen later snapshot; choosing an arbitrary historic initial snapshot from
  the UI is a possible later refinement (the engine already accepts any initial
  snapshot).
- The Initial / Actual-result navigation maps onto the Projected Board engine's
  Initial/Projected toggle; the "Actual result" view currently reuses the
  projected rendering surface and does not yet render the observed later snapshot
  as its own board layout (the comparison cards already carry the observed
  column). This is a UI refinement, not a data gap.
- `rateReliable` depends on the board exposing a column order; boards that do not
  expose one will always show the rate as unavailable (by design, to avoid a
  misleading number).
- Real-browser validation in Chrome against a live Azure DevOps board is pending
  (see §11). No claim of real-Chrome testing is made here.

---

## 11. Chrome manual homologation checklist (NOT yet executed)

1. Extension loads in `chrome://extensions` with no errors after adding
   `src/data/daily-comparison.js` to the manifest.
2. On a configured board, open the snapshot panel; the "Daily Comparison /
   Comparação da Daily" sub-section and the "Daily views" navigation are visible.
3. Capture a morning snapshot, save a commitment, capture an afternoon snapshot.
4. Click "Compare daily": the later-snapshot picker lists only same-board
   snapshots captured after the initial one; the newest is selected by default.
5. The metrics summary, the undetermined line and the proven fulfillment rate are
   correct; with an unreliable order the rate shows "unavailable".
6. Each comparison card shows initial → expected → observed column, the status
   badge and, for off-track/missing, a localized explanation.
7. The result filters (All / Reached / Beyond / Behind / Off-track / Missing)
   narrow the cards without recomputing or re-reading the board.
8. The daily-views navigation switches Initial / Projected / Actual / Comparison
   while preserving the selected snapshot/commitment.
9. Switching the language (EN/PT) translates every label, metric, filter,
   explanation and reliability line without losing the current selection.
10. The floating WIP indicator number is unchanged; a single external board
    change triggers exactly one recompute (R1 preserved); no work item is moved.
