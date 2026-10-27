# Sprint Progress (T2.3)

> Computes and visualizes sprint progress against the IMMUTABLE planned baseline,
> the configurable flow columns and the scope changes. Delivery data, kept
> SEPARATE from WIP. No credentials. The read-only API client (T2.1) stays OFF
> and unwired; this layer works on the DOM scope + a manual sprint + the local
> baseline recorded in T2.2, and never presents simulated data as real.

## Module (pure, Chrome-free, DOM-free)

| Module | Namespace | Responsibility |
|---|---|---|
| `src/data/sprint-progress.js` | `WIPBoardSprintProgress` | Progress calculation + six-state classification + reliability verdict + late-baseline flag. Reuses the T2.2 scope/baseline engines; reimplements nothing. |

`content.js` adds a "Sprint progress" sub-section INSIDE the existing Sprint
Intelligence block; `manifest.json` loads the module before `content.js`.

## What it answers (goal objective)

- How many items were PLANNED → `baseline.total` (the immutable baseline size).
- How many were COMPLETED → `baseline.completed` (reached the END column).
- Completion percentage → `baseline.completionPct` (the PRIMARY metric).
- How many are IN PROGRESS → `baseline.inProgress`.
- How many were ADDED during the sprint → `scopeChange.added`.
- How many were REMOVED from scope → `scopeChange.removed`.
- Original-planning progress → the baseline block.
- Current-scope progress → the `current` block (SECONDARY, kept separate).
- Which data is insufficient → `baseline.unknown` + `reliability`.

## Reuse (goal section 1)

The engine is a thin layer ON TOP of T2.2. It calls:

- `WIPBoardSprintScope.buildScopeItems` — stable-id dedupe, `System.State` kept
  DISTINCT from the board column, Feature/Epic flag.
- `WIPBoardSprintBaseline.detectScopeChanges` — planned/added/removed detection
  and the Feature-exclusion report.
- `WIPBoardSprintBaseline.resolveFlow` / `sameColumn` — configurable flow
  boundaries and accent/case/space-insensitive column matching.

It never recreates the scope or persistence algorithms, and never mutates its
inputs (a deep-frozen baseline computes fine).

## Primary calculation (goal section 2)

```
Baseline Completion (%) =
  (baseline items whose boundary column == END column) / (baseline total) × 100
```

- The END column is configurable (default `Closed`); the START column is
  configurable (default `Approved`). Example flow: `Approved → Development → HO →
  Closed`.
- Rounded to two decimals.

Worked example (the goal's example):

| Input | Value |
|---|---|
| Baseline | 20 items |
| Baseline completed | 12 |
| **Baseline completion** | **60%** |
| Added during the sprint | 5 (separate) |
| Removed from scope | 2 (separate) |

Additions and removals do NOT change the 60%. The baseline denominator stays 20;
a removed item is simply not completed; an added item is tracked in the current
scope only. No work item is double-counted (stable-id dedupe).

## Current-scope progress (goal section 3)

A SEPARATE secondary metric:

```
Current Scope Completion (%) =
  (current items whose boundary column == END column) / (current total) × 100
```

Reported alongside: `scopeChange.added`, `scopeChange.addedCompleted` (additions
that reached the END column), and the signed `scopeChange.delta` (current total −
baseline total). Baseline progress and current-scope progress are never merged;
the UI highlights the baseline as the primary figure.

## Work-item states (goal section 4)

Each baseline item is classified into exactly one state; additions are their own
state:

| State | Rule |
|---|---|
| `completed` | present AND boundary column == END |
| `not-started` | present AND boundary column == START |
| `in-progress` | present, resolvable, not END and not START |
| `removed-from-scope` | in the baseline but absent from the current scope |
| `unknown` | present but the boundary column/state cannot be determined |
| `added-after-baseline` | present now, not in the baseline |

Rules honored:

- `System.State = Closed` is NOT equivalent to the last board column. Completion
  is decided by the END **board column**; matching against `System.State` is an
  explicit `useState` opt-in, never a silent fallback.
- An undeterminable column is `unknown`, never assumed complete (goal section 8).
- Renamed columns work via normalization (accents/case/whitespace-insensitive).
- Partial data and incomplete configuration degrade to `unknown`, not to a
  fabricated completion.

## Hierarchy and counting policy (goal section 5)

Delivery counting happens at a SINGLE backlog level. Feature/Epic PARENTS are
excluded from the counts by default (reusing the T2.2 `countFeatures` flow flag)
and the exclusion is always reported under `featuresExcluded`, never silent. A
parent and its children are therefore NOT counted as independent deliveries
unless the board is explicitly configured to count the parent level
(`flowConfig.countFeatures = true`). The counting level is thus determined by the
flow configuration, not assumed uniform across types. `featureTypes` is
configurable so Agile/Scrum/CMMI templates work.

## Baseline integrity (goal section 6)

- The baseline is immutable; the engine never recomputes it from the current
  state and never mutates it (proven by a test that compares the serialized
  baseline before/after two computations).
- No history of entries/exits is invented from a single snapshot.
- `lateBaseline` is `true` when the baseline was captured more than one day after
  the sprint start, so the UI labels it instead of treating it as a true
  start-of-sprint snapshot.
- With the API disabled/unauthenticated, progress is computed only from the local
  baseline + the DOM scope; nothing incomplete is presented as official history.
- The filtered WIP of the board is NEVER used as the sprint denominator; the
  denominator is always the immutable baseline total.

## Reliability (goal section 8)

| Verdict | Meaning |
|---|---|
| `sufficient` | every baseline item has a known position; the % is complete |
| `partial` | some baseline items are `unknown`; the % is proven-only, and the UI shows the evaluable count alongside |
| `unavailable` | no baseline; no percentage at all |

When evidence is partial the UI shows "X% proven completed (E of T evaluable)"
rather than a single optimistic/pessimistic figure.

## Interface

Inside the Sprint Intelligence panel, a "Sprint progress / Progresso da sprint"
sub-section shows: an emphasized PRIMARY baseline-completion bar + the
completed/planned counts + the state counts (completed, in progress, not started,
removed, insufficient evidence); a visually distinct SECONDARY current-scope
block (current %, current counts, added, added completed, scope delta); a
per-column/stage distribution with an unknown bucket; a late-baseline banner when
applicable; and a reliability line. Simple, library-free HTML/CSS progress bar.
All strings are bilingual EN/PT; every DOM write goes through
`setIndicatorHtml()` and the section is mounted inside the existing
`withObserverPaused()` phase, preserving the R1 observer fix.

## Quality & security

- Feature flag `azureApiEnabled` default false; the API transport is NOT wired
  into this runtime (T2.1 decision + the `ado-manifest-safety` guard).
- No token or PII is read or persisted by this module; it is pure computation.
- Isolation by organization/project/team/board AND sprint id is inherited from
  the T2.2 baseline persistence; the engine measures one baseline against one
  current scope and never mixes scopes.
- Manifest V3 preserved; no new permission; same UMD namespace pattern.
- WIP and Daily regressions preserved (full suite green).

## Test evidence

`npm test` → 401 pass / 0 fail (375 prior + 25 new + 1 T2.3 i18n parity check):
`test/sprint-progress.test.js` and the T2.3 key-parity check in
`test/i18n-parity.test.js`. All offline; no live network.

## Proven vs pending

- **Proven offline:** the 60% baseline example, additions/removals counted
  separately without changing the baseline %, completion of an added item,
  removal before completion, all/none completed, unknown classification, the
  partial reliability verdict, configurable + renamed columns, State-vs-column
  separation, duplicate-id dedupe, parent/child counting policy, late-baseline
  detection, incomplete snapshot handling, API-disabled computation, and
  baseline immutability under scope change.
- **Pending (homologation policy, goal section 11):** real-browser validation in
  Chrome and live, signed-in API access to a real tenant. Both remain gated on
  the authenticated spike.

## Chrome manual checklist (not yet executed)

1. Extension loads with no console errors.
2. With a recorded baseline, the "Sprint progress" sub-section shows the baseline
   completion bar and counts.
3. Moving cards updates the completed/in-progress counts and the % but NEVER the
   baseline denominator.
4. Adding/removing items updates the added/removed counts without changing the
   baseline %.
5. An item with no resolvable column appears under "insufficient evidence" and
   the reliability line turns to "partial".
6. Language toggle relabels the section without losing the computed metrics.
7. WIP indicator and Daily panels are unaffected.
