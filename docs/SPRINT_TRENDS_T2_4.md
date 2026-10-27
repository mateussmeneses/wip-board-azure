# Sprint Trends & Risk Analysis (T2.4)

> Temporal analysis of the sprint over successive, PERSISTED observations.
> Delivery data, kept SEPARATE from WIP. No credentials. The read-only API
> client (T2.1) stays OFF and unwired; this layer works on the local immutable
> baseline (T2.2), the local observation history and the manual/DOM sprint, and
> never presents simulated data or a fabricated series as real. Roadmap
> Intelligence is explicitly NOT part of this task.

## Modules (pure/persistence, Chrome-free where applicable)

| Module | Namespace | Responsibility |
|---|---|---|
| `src/data/sprint-trends.js` | `WIPBoardSprintTrends` | PURE, Chrome/DOM/network-free trend + risk engine. Reuses the T2.3 progress engine per observation; reimplements no classification. |
| `src/data/sprint-observation-store.js` | `WIPBoardSprintObservationStore` | chrome.storage.local persistence of successive sprint-state observations. The smallest additional contract, mirroring the snapshot/goal stores. |

`content.js` adds a "Sprint trends & risk / Tendências e risco da sprint"
sub-section INSIDE the existing Sprint Intelligence block; `manifest.json` loads
both modules before `content.js`.

## What it answers (goal objective)

- Progress evolution over time → the completion time series.
- Observed progress vs elapsed time → `time` + the linear reference line.
- Scope-change evolution → the `scopeTimeline` between observations.
- Remaining work → the `burndown` series; done work → the `burnup` series.
- Delivery trends → the series shape + the risk signals.
- Data-grounded risk alerts → the heuristic `risk` verdict + signals.
- Limitations/reliability → `limitations` + per-point `reliability`.

## Observation contract (goal section 2)

Each persisted observation (`sprint-observation` record) carries:

- `scope`: organization / project / team / board identity.
- `sprintId`: the sprint identity.
- `capturedAt`: `{ iso, epochMs, timezoneOffsetMinutes, localDay }` — capture
  date/time with timezone preserved (goal section 9: fusos horários).
- `source`: where the data came from (`dom-reader` | `api` | …).
- `baselineRef`: `{ sprintId, revision, capturedAt }` — WHICH baseline this
  observation is measured against. The baseline itself is NEVER copied or
  mutated here (goal section 2).
- `items`: the observed work items (`id` + `column`/`state`), de-duplicated by
  stable id. The DOM is NOT used to reconstruct past states; only what was
  captured is stored.
- `complete` + `reliability` + `incompleteReasons`: completeness and confidence
  indicators (goal sections 2 & 9).
- `metrics`: optional derived metrics, never required.

Records are immutable and append-only: a correction is a NEW observation, never
an in-place edit. Keys embed scope + sprint id so different teams/boards/sprints
never collide. Retention prunes the oldest beyond a configurable cap. Capture is
an EXPLICIT user action ("Record observation") reusing the existing
`SnapshotCapture` completeness verdict; there is NO background schedule that
needs a permanently-open browser (goal section 2).

## Trend engine (goal section 3)

`WIPBoardSprintTrends.computeTrends({ sprint, baseline, history, flowConfig,
riskConfig, now })` returns a plain object:

- `series[]`: one point PER REAL OBSERVATION (goal section 5 — no fabricated
  daily point), each with the observation date, proven baseline completion %,
  completed / not-completed / unknown counts, current scope, added/removed and
  the observation reliability. Each point reuses
  `WIPBoardSprintProgress.computeProgress`, so the T2.3 six-state classification
  is honored, not duplicated (goal section 3).
- `time`: calendar-day elapsed math + the linear reference (see below).
- `burnup[]` / `burndown[]`: built only from the real instants.
- `scopeTimeline[]`: per-interval scope changes.
- `stagnation`: items with no movement across reliable observations.
- `risk`: the heuristic verdict + signals.
- `latest`, `limitations`, `riskConfig`.

The engine is PURE: no DOM, no Chrome, no storage, no HTTP. It never mutates its
inputs and reads the baseline read-only.

## Progress vs time (goal section 4)

- The elapsed-time percentage uses CALENDAR days only and is labelled
  `basis: 'calendar-days'` so any future business-day metric is a DIFFERENT
  field, never a silent reinterpretation. No holidays, work hours or calendars
  are assumed.
- A simple linear reference line equals the elapsed percentage. Example: a
  10-day sprint, 7 days elapsed → ~70% reference; observed completion 60% → the
  deviation is shown as INFORMATION, never as proof of delay. The reference is a
  visualization aid, NOT a statistical forecast.
- When dates are missing or inconsistent, `time.reliable` is false and no time
  percentage is invented (`elapsedPct` / `linearReferencePct` are null).

## Burnup & burndown (goal section 5)

- Burnup: completed baseline items vs the baseline total. The current scope is
  reported SEPARATELY, never merged into the baseline target (scope removal is
  not completed work).
- Burndown: planned baseline items NOT yet completed and NOT unknown. Unknown
  items are a separate series, never folded into done nor silently into
  remaining.
- Series are NOT forced monotonic: a reopened item lowers the completed count and
  raises the remaining count, and the series reflects that truthfully.
- Only the real observation instants are represented; no daily point is
  fabricated for a date with no capture.

## Scope-change timeline (goal section 6)

For each pair of successive observations, ids are classified as
added / removed / returned / still-planned. A change is labelled
`detection: 'in-interval'`: the exact instant is unknown, only the window
between the two captures. A baseline id that left and came back is a RETURN, not
merely an addition. Duplicates are collapsed; an id temporarily absent is a
removal in the interval it disappears and a return in the interval it reappears.

## Risk analysis (goal section 7)

A heuristic verdict — `On Track` / `Attention` / `At Risk` / `Insufficient Data`
— from explicit, configurable, documented thresholds in `DEFAULT_RISK_CONFIG`:

| Signal | Threshold (default) | Meaning |
|---|---|---|
| `behind-reference` | 10 pts (attention) / 25 pts (at-risk) | observed completion lags the linear time reference |
| `late-sprint-low-completion` | elapsed ≥ 80% AND completion < 60% | low progress near the sprint end |
| `scope-growth` | 15% (attention) / 30% (at-risk) of baseline | large scope additions |
| `stagnation` | ≥1 (attention) / ≥3 (at-risk) items over 3 reliable observations | items with no flow movement |
| `unknown-share` | 15% (attention); ≥30% forces Insufficient Data | high share of undeterminable items |

Gates toward Insufficient Data (preferred when evidence is thin): no baseline,
no history, fewer than `minReliableObservations` reliable observations, or a very
high unknown share. The verdict lists the contributing signals so the UI can
EXPLAIN it. No AI, no statistical forecast, no claim that the sprint will
certainly finish or certainly be late; a disclaimer states this in the UI.

## Interface (goal section 8)

Inside the Sprint Intelligence panel, the "Sprint trends & risk" sub-section
shows the sprint identity/period/elapsed (inherited from the T2.2/T2.3 blocks
above it), the observation count and the last-observation time, and a three-way
view toggle:

- **Progress**: elapsed time, the linear reference, observed baseline
  completion, a completion bar with the reference marker and the signed
  deviation.
- **Trends**: the completion series, the burnup/burndown points (with the
  "no fabricated daily points" note), and the colored risk badge + signal
  explanation + the "not a forecast" disclaimer.
- **Scope**: the scope-change timeline between observations.

A "Record observation" button captures the current state explicitly. All strings
are bilingual EN/PT (49 `trends*` keys); every DOM write goes through
`setIndicatorHtml()` and the section is mounted inside the existing
`withObserverPaused()` phase, preserving the R1 observer fix.

## Reliability & integrity (goal section 9)

Handled explicitly: no history, a single observation, incomplete captures,
unknown work items, late baseline, reopened items, column-config changes
(normalized matching), a changed finish date (recomputed span), scope-composition
changes, duplicate data (collapsed by capture instant and id), out-of-order
observations (sorted chronologically), timezones (preserved), a not-yet-started
or ended sprint (period `state`), and an unauthenticated API (the API stays
unwired; trends run on local data). Every historical analysis uses only
identified, effectively persisted data; no invented history is shown.

## Quality & security

- Feature flag `azureApiEnabled` default false; the API transport is NOT wired
  into this runtime (T2.1 decision + the `ado-manifest-safety` guard).
- No token or PII is read or persisted; observations store only
  ids/columns/states/timestamps + a baseline reference.
- Isolation by organization/project/team/board AND sprint id in every key.
- Manifest V3 preserved; no new permission; same UMD namespace pattern.
- WIP, R1 and Daily Intelligence regressions preserved (full suite green).

## Test evidence

`node --test` → 438 pass / 0 fail (401 prior + 36 new + 1 T2.4 i18n key-parity
check): `test/sprint-trends.test.js` (24),
`test/sprint-observation-store.test.js` (14) and the T2.4 key-parity check in
`test/i18n-parity.test.js`. All offline, with the shared mock-chrome-storage; no
live network.

## Proven vs pending

- **Proven offline:** per-observation series via the reused T2.3 engine, correct
  completion rates, chronological ordering of out-of-order/duplicate
  observations, the calendar-day elapsed math + linear reference + deviation, the
  70% elapsed example, below/above/at the reference, non-monotonic burnup/
  burndown with reopened items, the separate unknown series, scope add/remove/
  return detection labelled in-interval, stagnation detection, the heuristic risk
  verdict and its Insufficient-Data gates, configurable thresholds, late-baseline
  detection, a changed finish date, sprint/org isolation, and the
  immutable/append-only observation store (isolation, timezone preservation,
  completeness indicators, baseline-ref only, persistence after reload, pruning,
  STORAGE_FAILURE).
- **Pending (homologation policy, goal section 12):** real-browser validation in
  Chrome and live, signed-in API access to a real tenant. Both remain gated on
  the authenticated spike.

## Chrome manual checklist (not yet executed)

1. Extension loads with no console errors.
2. With a recorded baseline, "Record observation" appends an observation and the
   trends sub-section shows the series, burndown and risk badge.
3. The Progress view shows the elapsed-time reference and the deviation;
   recording more observations over time builds the series.
4. Reopening an item lowers the completed count in the next observation and the
   burndown rises (no forced monotonic series).
5. Adding/removing items shows up in the Scope view as detected-in-interval.
6. With few/unreliable observations the risk badge reads "Insufficient Data".
7. Language toggle relabels the section without losing the computed trends.
8. WIP indicator and Daily/Sprint panels are unaffected.
