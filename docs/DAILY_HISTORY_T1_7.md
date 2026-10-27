# Daily History — T1.7

> Status: implemented (automated tests green, 226 pass). Real-browser validation
> against a live Azure DevOps board is still PENDING (see the Chrome checklist
> below).
>
> Code comments stay in English. User-facing strings stay bilingual (EN / PT-BR).
> No existing feature is removed and WIP rule semantics are preserved. No commits
> or pushes were made by this task.

---

## 1. What this adds

A read-only historical view over the dailies already recorded for ONE board
scope. It answers the questions that span MANY dailies, not a single one:

- Which dailies were recorded (one row per daily), newest first?
- For each: the date, the scope (organization / project / team / board), the
  initial (planning) snapshot and time, the commitment id + revision in effect,
  the later (evaluation) snapshot and time, the counts (committed / reached /
  beyond / behind / off-track / missing) and the proven fulfillment rate?
- Across the filtered range: how many dailies, how many commitments, how many
  proven-fulfilled, the OVERALL proven rate (weighted by commitment count), the
  daily evolution, and how many records lack a trustworthy evaluation?

The history NEVER reads the live Azure DevOps board and never moves a work item.
It is math over stored snapshots and stored commitments only.

---

## 2. Reuse of the existing architecture (no second mechanism)

The per-item classification and the per-daily metrics are NOT reimplemented. They
are produced by `WIPBoardDailyComparison.buildComparison` (T1.6), which itself
delegates to `WIPBoardDailyCommitment.compareCommitment` (T1.3). T1.7 reuses that
whole chain through dependency injection; it never creates a second comparison or
metrics engine.

| Reused component | Role in T1.7 |
|---|---|
| `WIPBoardSnapshotStore` | Reads all snapshots and commitments for one board scope (`getSnapshots` / `getCommitments`), the persisted `evaluation` and the schema migration. No new store. |
| `WIPBoardReader` | Resolves the board scope (org/project/team/board) as in the other panel actions. |
| Daily Comparison view-model (`buildComparison`, `selectComparableSnapshots`) | The single source of the per-daily classification, metrics and reliability verdict. Injected into the history module. |
| Daily Commitment engine (`compareCommitment`) | The underlying reached/behind/beyond/off-track/missing rules, reached transitively through T1.6. |
| Projected Board + Comparison UI | The per-record "Open comparison" action loads the exact historic daily into the existing T1.6 comparison view, preserving the snapshot/commitment identity. |

The new module `src/features/daily/daily-history.js` (`WIPBoardDailyHistory`) is a pure,
Chrome-free and DOM-free AGGREGATION view-model. It adds only the parts T1.6 does
not cover: reconstruction of one daily record per commitment, deterministic
selection of the evaluation snapshot from PERSISTED data, date-range filtering,
chronological ordering, and commitment-weighted aggregate indicators.

---

## 3. Contracts and architecture of the history module

Pure functions, plain objects in and out, inputs never mutated:

```
RecordReliabilityReason = {
  NO_BASE_SNAPSHOT, NO_LATER_SNAPSHOT, INCOMPLETE_SNAPSHOT,
  UNRELIABLE_COLUMN_ORDER, NO_COMMITMENT, COMPARISON_FAILED
}

selectEvaluationSnapshot(cmpApi, commitment, baseSnapshot, candidates, nextPlanningEpoch)
  -> { snapshot, source: 'persisted' | 'inferred' | null }

buildHistory({ snapshots, commitments }, { comparison? })
  -> record[]   // newest-first by planning time

filterByDateRange(records, { from, to })  // inclusive yyyy-mm-dd, never mutates
  -> record[]

aggregate(records)
  -> summary   // see §5

buildHistoryView({ snapshots, commitments }, { comparison?, range? })
  -> { range, totalRecords, records, summary }
```

A record:

```
{
  commitmentId, revision, revisionInEffect, usedPersistedEvaluation,
  evaluationSource,                 // 'persisted' | 'inferred' | null
  scope, dailyDate, planningAt, planningAtEpoch, evaluationAt,
  initial: { id, when } | null,
  later:   { id, when } | null,
  metrics: { committed, reached, beyond, behind, offTrack, missing,
             fulfilled, undetermined, fulfillmentRate, rateReliable },
  reliability: { reliable, reasons: [RecordReliabilityReason...] },
  vm                                // the full T1.6 comparison view-model | null
}
```

The UI (`content.js`) only renders this; it computes nothing of its own.

---

## 4. Reliability and integrity (requirement 3 — the most important rule)

Enforced explicitly, and surfaced rather than hidden:

- The history is reconstructed EXCLUSIVELY from persisted, identified records.
  The live Azure DevOps state is never read and never fills a historical gap.
- The revision in effect at evaluation time is preserved. When a commitment
  carries a persisted `evaluation.revision`, that archived plan is compared; the
  current revision is NEVER silently substituted for the original plan. Without a
  persisted evaluation, the current plan is compared but `revisionInEffect` stays
  `null` and `usedPersistedEvaluation` is `false`, so the UI never claims the
  current plan was the original.
- Records from different organization / project / team / board are never mixed:
  the caller passes records for a single scope, and the module additionally
  asserts same-scope on every snapshot it links (`sameScope`).
- Multiple dailies on the same calendar day keep distinct identities (one record
  per commitment); they are never merged. The deterministic evaluation window
  ends at the NEXT daily's planning time, so one daily never steals a later
  daily's snapshot.
- A commitment whose base/evaluation snapshot is missing is NOT dropped: it is
  surfaced as a record flagged `NO_BASE_SNAPSHOT` / `NO_LATER_SNAPSHOT`, with the
  planned total still shown from the commitment's own items.

### The "one commitment per board" limitation — investigated and resolved

Before T1.7 the commitment contract carried no persisted link to the snapshot
used at evaluation time, so a board effectively represented a single evaluable
daily. The MINIMAL, non-destructive evolution was applied in
`src/data/snapshot-store.js`:

- `SCHEMA_VERSION` bumped `1 -> 2`.
- An ADDITIVE `evaluation` field on commitments: `{ laterSnapshotId, revision,
  evaluatedAt } | null`.
- A forward `migrateRecord(record)` migration applied on read: a v1 commitment
  gains `evaluation: null`; a v1 snapshot only advances its version and gains no
  `evaluation` field.
- `recordCommitmentEvaluation(scope, id, { laterSnapshotId, revision,
  evaluatedAt })` persists the evaluation and REFUSES a call without a
  `laterSnapshotId` (`INVALID_COMMITMENT`). It never alters the plan or the
  revision.

The migration is backward-compatible: old data reads back as v2 with
`evaluation: null`, and the history still produces an honest record for it (it
falls back to a deterministic inferred evaluation snapshot and flags the source
as `inferred`). Multiple commitments per board, and multiple dailies per day, are
represented as distinct records keyed off the stable commitment id.

---

## 5. Indicators (requirement 4)

`aggregate(records)` returns:

- `dailies` — number of records in scope.
- `reliableDailies` — records that contributed to the overall rate.
- `unreliableDailies` — records WITHOUT a trustworthy evaluation.
- `committed` — total planned commitments (all records).
- `reliableCommitted` — committed within reliable records (the rate base).
- `fulfilled` — proven `reached + beyond` within reliable records.
- `reached`, `beyond`, `behind`, `offTrack`, `missing` — totals across all records.
- `undetermined` = `offTrack + missing` (reported apart, never proven failures).
- `overallRate` = `(fulfilled / reliableCommitted) * 100`, one decimal, or `null`.
- `rateReliable` — `false` ⇒ the UI must not show a percentage.
- `evolution` — `[{ date, committed, fulfilled, rate, reliable, dailies }]`,
  oldest-first for a left-to-right chart.

The overall rate is WEIGHTED by commitment count, not an average of the daily
percentages. Only records whose rate is reliable contribute, so an unevaluated
daily can never inflate or deflate the overall number. `missing`/`off-track` are
reported as undetermined; "no reliable evaluation" is counted separately from
"zero commitments", so absence of data is never shown as 0%.

---

## 6. UI (requirement 5)

Inside the existing `#wip-snapshot-panel`, a "Daily History / Histórico da Daily"
sub-section (`#wip-history-section`), shown only when the history module, the
comparison view-model and the commitment engine are all present:

- Historical summary (dailies / planned / proven-fulfilled / undetermined) and a
  separate overall proven rate (or an explicit "unavailable" line) plus the count
  of records without a reliable evaluation.
- Period filter: two `date` inputs (from / to), Apply and Clear.
- Simple evolution chart: a labeled bar per day built from HTML + CSS only (no
  chart library); unavailable days render a grey bar and "n/a".
- Daily list: one compact card per record, newest-first, with the date, scope,
  initial/later snapshot ids and times, commitment id + revision in effect,
  the per-category counts, the proven rate (or "unavailable"), an inferred-
  evaluation note when applicable, and the reliability reasons.
- Per-record "Open comparison" button that loads the EXACT historic daily into
  the existing T1.6 comparison view (same commitment + later snapshot identity),
  then switches to it. No history recompute and no board read beyond what the
  comparison already does.

All strings are localized EN/PT (37 `history*` keys, verified by
`test/i18n-parity.test.js`). Every history DOM write goes through
`setHistoryOutput` ⇒ `setIndicatorHtml` (diff-before-write), preserving the R1
discipline; board-derived text is HTML-escaped before it reaches innerHTML.

---

## 7. Persistence and retention (requirement 6)

- `WIPBoardSnapshotStore` is reused as-is; no new store.
- Retention can prune a snapshot still referenced by a historic commitment. This
  is handled HONESTLY: the history keeps the commitment's record and flags
  `NO_BASE_SNAPSHOT` / `NO_LATER_SNAPSHOT` instead of fabricating a baseline from
  the live board. Proven by `test/daily-history.test.js` (retention integrity).
- No commitment, snapshot or revision is deleted automatically by this feature;
  the migration is additive and non-destructive; only non-sensitive fields are
  stored (no tokens, cookies, credentials or raw HTML).

---

## 8. Tests

- `test/daily-history.test.js` (25): empty history; one daily; multiple dailies;
  different commitment counts; commitment-weighted overall rate; partially
  fulfilled; incomplete snapshot flagged + excluded from the rate; no later
  snapshot; missing and off-track as undetermined; revision in effect preserved
  (archived vs current plan); several dates for one board; two dailies on the
  same day kept distinct; inferred evaluation does not steal a later daily's
  snapshot; board isolation (foreign-scope snapshot never selected); date-range
  filter narrows list + aggregate; undated record excluded under a bound;
  newest-first ordering; day-boundary via `localDay`; missing base surfaced, not
  dropped; schema migration v1→v2 additive `evaluation`; retention referential
  integrity; end-to-end through the real store with persistence after reload and
  `recordCommitmentEvaluation` (refusal without `laterSnapshotId`, plan/revision
  untouched); reuse of the injected comparison engine (single call); module
  hygiene (no DOM, no MutationObserver, no Chrome, no innerHTML, no WIP number).
- `test/i18n-parity.test.js` (+1): the T1.7 `history*` keys exist in both EN and
  PT; whole-pack parity, placeholder-token parity and no-empty-string invariants
  cover the new strings.

Full suite: **226 tests pass** (201 prior + 25 new daily-history + 1 added parity
check minus the parity count already folded into the 201 at T1.6; the runner
reports 226).

Regression evidence (run explicitly): `mutation-observer-r1`,
`projected-board-r1`, `commitment-picker-r1`, `wip-logic`,
`wip-runtime-integration`, `runtime-stability`, `i18n-parity` all pass — the WIP
rules, the R1 MutationObserver fix and the EN/PT parity are preserved.

---

## 9. Demonstration with fictional data

Two dailies on the same board, flow `Approved → Desenvolvimento → Code Review →
HO → Closed`.

Daily A (2024-05-10), 4 commitments to `Code Review`; later snapshot:

```
Code Review: #1        (reached)
Approved:    #2 #3 #4  (behind x3)
```

Daily B (2024-05-11), 1 commitment to `Closed`; later snapshot:

```
Closed: #9             (reached)
```

Aggregation:

- records = 2, dailies = 2, reliableDailies = 2.
- committed = 4 + 1 = 5; fulfilled = 1 + 1 = 2.
- overall proven rate = (2 / 5) × 100 = **40.0%** (weighted). A simple average of
  the daily rates would be (25% + 100%) / 2 = 62.5%, which the module explicitly
  avoids.
- evolution = `[{ 2024-05-10, rate 25 }, { 2024-05-11, rate 100 }]`, oldest-first.

If Daily B had no later snapshot, its record would be flagged
`NO_LATER_SNAPSHOT`, dropped from `reliableCommitted`, counted in
`unreliableDailies`, and the overall rate would become (1 / 4) × 100 = 25.0% over
the single reliable daily — never a fabricated number for the unevaluated one.

---

## 10. Treatment of revisions and incomplete data

- Revision in effect: taken ONLY from a persisted `evaluation.revision`; the T1.6
  `resolvePlan` compares that archived revision verbatim and flags `usedArchived`.
  Without one, the current plan is compared and the record reports
  `revisionInEffect: null` / `usedPersistedEvaluation: false`.
- No base snapshot ⇒ `NO_BASE_SNAPSHOT`, planned total from the commitment's own
  items, excluded from the overall rate.
- No later snapshot ⇒ `NO_LATER_SNAPSHOT`, no invented rate.
- Incomplete snapshot ⇒ `INCOMPLETE_SNAPSHOT`, excluded from the overall rate.
- Unknown column order ⇒ `UNRELIABLE_COLUMN_ORDER`, items stay `off-track`, rate
  suppressed.
- Comparison failure ⇒ `COMPARISON_FAILED`, record kept and flagged.

---

## 11. Risks and limitations (for final homologation)

- The deterministic "inferred" evaluation snapshot (used when no persisted
  `evaluation` exists on older data) is a best-effort reconstruction bounded by
  the next daily's planning time; it is clearly flagged `evaluationSource:
  'inferred'` so the UI caveats it. Persisting the evaluation
  (`recordCommitmentEvaluation`) removes the ambiguity going forward.
- `rateReliable` depends on the board exposing a column order; boards that do not
  will always show the rate as unavailable (by design, to avoid a misleading
  number).
- The history reads whatever the retention policy left; a board whose snapshots
  were aggressively pruned will show more `NO_BASE_SNAPSHOT` / `NO_LATER_SNAPSHOT`
  records. Operators who want long history should raise `maxSnapshotsPerBoard` /
  `maxAgeDays`.
- Real-browser validation in Chrome against a live Azure DevOps board is pending
  (see §12). No claim of real-Chrome testing is made here.

---

## 12. Chrome manual homologation checklist (NOT yet executed)

1. Extension loads in `chrome://extensions` with no errors (the manifest already
   loads `src/features/daily/daily-history.js` before `content.js`).
2. On a configured board, open the snapshot panel; the "Daily History / Histórico
   da Daily" sub-section is visible.
3. Record several dailies over different days (capture → commit → capture later →
   evaluate) and click "Refresh history".
4. The daily list shows one card per daily, newest-first, with the date, scope,
   snapshot ids/times, commitment id + revision in effect and the per-category
   counts.
5. The historical summary, the overall proven rate (weighted) and the count of
   records without a reliable evaluation are correct; an unevaluated daily shows
   "unavailable", not 0%.
6. The evolution chart shows one bar per day, oldest-first, with grey "n/a" bars
   for unavailable days.
7. The period filter (from / to) narrows both the list and the summary; Clear
   restores the full range.
8. Two dailies recorded on the same day appear as two distinct cards (not merged)
   and the day's evolution bucket reports two dailies.
9. "Open comparison" on a record loads that exact daily into the T1.6 comparison
   view, preserving the snapshot/commitment identity.
10. Switching the language (EN/PT) translates every label, metric, chart label and
    reliability line without losing the loaded history.
11. The floating WIP indicator number is unchanged; a single external board change
    triggers exactly one recompute (R1 preserved); no work item is moved.
