# Sprint Scope & Goal (T2.2)

> Base functional layer for Sprint Intelligence: identify the sprint, present its
> period and goal, and record the initially planned scope as an immutable
> baseline. Delivery data, kept SEPARATE from WIP. No credentials. The read-only
> API client (T2.1) stays OFF and unwired; this layer works on the DOM scope + a
> manual sprint + local persistence, and never presents simulated data as real.

## Modules (pure, Chrome-free, DOM-free)

| Module | Namespace | Responsibility |
|---|---|---|
| `src/features/sprint/sprint-scope.js` | `WIPBoardSprintScope` | Sprint identity normalization; inclusive period/day math; scope-item building (state kept distinct from board column; Feature/Epic flagged). |
| `src/features/sprint/sprint-baseline.js` | `WIPBoardSprintBaseline` | Immutable baseline of planned ids + start column/state; scope-change detection against that fixed reference; configurable flow boundaries. |
| `src/data/sprint-goal-store.js` | `WIPBoardSprintGoalStore` | chrome.storage.local persistence of the goal (with revision history) and the baseline (saved once; explicit re-baseline archives the prior). |
| `src/features/sprint/sprint-intelligence.js` | `WIPBoardSprintIntelligence` | Availability resolution + composed UI view-model; carries no fabricated sprint in any unavailable state. |

`content.js` adds a compact, bilingual "Sprint Intelligence" sub-section inside
the existing snapshot panel; `manifest.json` loads the four modules before
`content.js`.

## Data model

### Sprint identity (normalizeSprint)
`{ id, name, iterationPath, startDate, finishDate, source, available }`. Missing
fields are the frozen `UNAVAILABLE` sentinel (shape-compatible with the API
contracts and the snapshot store), never invented. `source` is `api | manual |
none`.

### Period math (computeSprintDays)
`{ totalDays, elapsedDays, remainingDays, state }`. Days are counted inclusive of
both boundaries; elapsed/remaining are clamped to the range. When a boundary is
missing (or finish precedes start), all numbers are `null` and `state` is
`unknown` — the goal forbids inventing unavailable information.

### Baseline (createBaseline)
A deep-frozen record: `{ schemaVersion, kind, sprintId, iterationPath, flow,
capturedAt, plannedIds, plannedItems[{ id, type, startColumn, startState,
parentId, isFeature }], featuresExcluded, source }`. The baseline is the FIXED
reference for the whole cycle; it never changes when cards move.

### Scope changes (detectScopeChanges)
Per stable id, classified against the baseline:
`planned` (in baseline and present), `added` (present, not in baseline — scope
growth), `removed` (in baseline, gone), `completed` (present and in the END
boundary), `inProgress` (present, not in END). Plus a `summary` with counts and a
signed `scopeDelta`.

### Goal (sprint-goal-store)
`{ objective, description, successCriteria[], priorities[] }`. Every content
change archives the prior under `revisions[]` and bumps `revision`; an identical
save is a no-op (no empty revision). Keyed by scope + sprint id.

## Flow configuration (goal section 4)

The team's main flow is `Approved -> intermediate columns -> Closed`. The start
and end columns are configurable per board via `flowConfig` (and the optional
`sprintStartColumn` / `sprintEndColumn` config keys). Rules honored:

- **System.State is NOT the board column.** Completion is decided by the END
  board column by default. Matching the boundary against `System.State` is an
  explicit `useState` opt-in, never a silent fallback.
- **Feature/Epic parents** are excluded from the scope counts unless
  `countFeatures` is explicitly true, and the exclusion is always reported under
  `featuresExcluded` (never silent).
- **Stable ids only.** Duplicates collapse; nothing is inferred from card
  position.

## Availability states (never simulate)

`WIPBoardSprintIntelligence.resolveAvailability` returns one of:

| State | Meaning | Carries a sprint? |
|---|---|---|
| `disabled` | API flag off (default) | no |
| `unauthenticated` | flag on, no auth / 401 / 403 | no |
| `unavailable` | flag on + auth but nothing usable returned | no |
| `manual` | a manually configured, local sprint | yes (real, user data) |
| `api` | a sprint resolved from the read-only API | yes (real) |
| `no-sprint` | the source responded; team has no current sprint | no |

Only `api` and `manual` set `dataReal = true`. The UI labels every unavailable
state and never dresses it up as live data.

## Interface

The "Sprint Intelligence" sub-section shows the sprint identity, iteration path,
period (start → finish), days elapsed/remaining, current scope size, and — when a
baseline exists — planned/added/removed/completed/in-progress counts, plus an
availability banner with a Live / Manual / Unavailable badge. Forms let the user
configure a manual sprint (id/name + start/finish dates, persisted locally) and
edit + save the goal. All strings are bilingual EN/PT; every DOM write goes
through `setIndicatorHtml()` and the section is mounted inside
`withObserverPaused()`, preserving the R1 observer fix.

## Quality & security

- Feature flag `azureApiEnabled` default false; the API transport is NOT wired
  into this runtime (T2.1 decision + the `ado-manifest-safety` guard).
- No token is persisted; only planning text and ids go to storage.local.
- Isolation by organization/project/team/board AND sprint id in every key.
- Manifest V3 preserved; no new permission; same UMD namespace pattern.
- WIP and Daily regressions preserved (full suite green).

## Test evidence

`npm test` → 375 pass / 0 fail (327 prior + 47 new + 1 i18n parity check):
`test/sprint-scope.test.js`, `test/sprint-baseline.test.js`,
`test/sprint-goal-store.test.js`, `test/sprint-intelligence.test.js`, and the
T2.2 key-parity check in `test/i18n-parity.test.js`. All offline, with the shared
mock-chrome-storage; no live network.

## Proven vs pending

- **Proven offline:** identity normalization, period math (incl. unavailable
  boundaries), immutable baseline, scope-change classification, configurable flow
  boundaries, state-vs-column separation, Feature counting rule, goal revision
  history, once-only baseline, availability resolution, the "no simulated data"
  rule.
- **Pending (homologation policy, goal section 8):** real-browser validation in
  Chrome and live, signed-in API access to a real tenant. The API wiring and the
  % Approved→Closed completion metric are the next task (T2.3 — Sprint Progress).

## Chrome manual checklist (not yet executed)

1. Extension loads with no console errors.
2. The Sprint Intelligence sub-section appears in the snapshot panel on a
   configured board.
3. With the API flag off, the banner shows "disabled" and the manual-sprint form
   lets a sprint be configured and persisted across reload.
4. Recording the baseline captures the current scope; moving cards updates
   planned/added/completed counts but NEVER changes the baseline.
5. Saving the goal twice preserves the prior revision.
6. Language toggle relabels the section without losing the loaded data.
7. WIP indicator and Daily panels are unaffected.
