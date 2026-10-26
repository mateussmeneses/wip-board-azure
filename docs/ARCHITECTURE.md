# Architecture — WIP Board Azure

> Status: proposed evolution. This document describes the current (as-is) architecture
> and the target (to-be) modular architecture for evolving the extension from a pure
> WIP monitor into a delivery-tracking tool (Daily Commitment, Sprint Intelligence,
> Roadmap Intelligence, History).
>
> Code comments stay in English. User-facing strings stay bilingual (EN / PT-BR).
> No existing feature is removed and WIP rule semantics are preserved.

---

## 1. Current architecture (as-is)

The extension is a Chrome Manifest V3 project with no build step and no dependencies.
All logic lives in three runtime files plus two config files.

```
manifest.json      Extension metadata, host permissions, content-script match patterns.
popup.html         Configuration UI markup (bilingual, driven by element IDs).
popup.js           Loads/saves settings in chrome.storage.sync; popup i18n; validation.
content.js         Injected on board routes. Reads DOM, computes WIP, renders indicator.
version.json       Local version token; compared against GitHub raw for update nudge.
```

### 1.1 Runtime flow (content.js)

```
init()
  -> startBoardObservation()
       -> observer.observe(document.body, { childList, subtree })   // MutationObserver
       -> bootstrapBoardRender()   // retries up to 10x while Azure mounts the board
  -> chrome.storage.onChanged -> updateWipBoard()
  -> window 'pageshow' -> ensureBoardMounted()

updateWipBoard()
  -> chrome.storage.sync.get([...18 keys])
  -> getBoardContext(data)                 // normalize settings once
  -> isAllowedBoard(boardName, routeFilter) // URL keyword gate
  -> scan .kanban-board-column-header / .kanban-board-column
  -> isConfiguredWipColumn() filters columns
  -> per card: isCardVisible(), getCardAssignees(), analyzeCard(), analyzeSpecialRule()
  -> applyCardAlarm() for each WIP card
  -> compute finalWip (special-person block reduction)
  -> displayWip() -> applyWipIndicatorState()
```

### 1.2 Current data sources

| Signal | Source | Selector / mechanism |
|---|---|---|
| Work item id | DOM | `.wit-card[data-itemid]` (stable integer, e.g. `620906`) |
| Org + project | DOM | card title `href="/<org>/<project>/_workitems/edit/<id>"` and URL |
| Column name | DOM | `.kanban-board-column-header` aria-label / `.click-edit-field` |
| State | DOM | `.work-item-state-name span` |
| Assignee | DOM | `.identity-display-name span` |
| Aging (days) | DOM | `.field-container` label `aging` |
| Target Date | DOM | `.field-container` label `target date` (dd/mm/yyyy) |
| Tags | DOM + fallback | `.field-container` label `tags`; fallback regex over serialized page HTML by item id |
| Remote version | network | GitHub raw `version.json` (best-effort) |

Persistence is entirely `chrome.storage.sync`. There is no authentication and no REST
API usage today. See the Configuration Keys section of `AGENTS.md` for the key list.

---

## 2. Target architecture (to-be)

The goal is to add delivery intelligence **without** a build toolchain change and
**without** coupling the new modules to the fragile DOM scraping that powers WIP.

### 2.1 Layering principle

```
+-------------------------------------------------------------+
|  UI layer         popup.html + panels (indicator, details)  |
+-------------------------------------------------------------+
|  Feature modules  wip / daily-commitment / sprint / roadmap |
|                   / history   (each consumes the data layer)|
+-------------------------------------------------------------+
|  Data layer       board-dom-reader  (DOM scraping, as today)|
|                   ado-api-client    (read-only REST, opt-in) |
|                   snapshot-store     (chrome.storage.local)  |
+-------------------------------------------------------------+
|  Core             context (org/project/team/board), i18n,   |
|                   config, work-item model, utils            |
+-------------------------------------------------------------+
```

Separation of concerns that the goal explicitly requires:

- **WIP metrics stay independent from delivery metrics.** WIP is a live count of
  cards in configured columns. Delivery metrics (commitment hit rate, sprint %
  completion, roadmap progress) are derived from stable work item ids over time.
  They never mutate the WIP number.
- **Every delivery indicator keys off the stable work item id** (`data-itemid`),
  never off DOM position, title text, or assignee name.
- **Every indicator is scoped** by organization + project + team + board, derived
  from the URL and card hrefs, so multi-team usage keeps data isolated.

### 2.2 Proposed module responsibilities

| Module | Responsibility | Data source | Notes |
|---|---|---|---|
| `core/context` | Resolve org/project/team/board id from URL + card href | DOM/URL | Pure, testable |
| `core/i18n` | Shared EN/PT message packs (extracted from content.js & popup.js) | — | Single source of truth |
| `core/config` | Read/normalize `chrome.storage.sync` settings | storage | Wraps `getBoardContext` |
| `core/work-item` | Normalized work item model `{ id, type, state, column, assignee, aging, targetDate, tags }` | — | Produced by readers |
| `data/board-dom-reader` | Extract work items from current board DOM | DOM | Refactor of current scrape |
| `data/ado-api-client` | Read-only REST calls (same-origin, session cookie) | network | Opt-in, feature-flagged |
| `data/snapshot-store` | Persist daily snapshots keyed by board+date | storage.local | Bounded retention |
| `features/wip` | Existing WIP calc + indicator (unchanged semantics) | board-dom-reader | Behavior-preserving |
| `features/daily-commitment` | Record expected vs actual column per item per day | snapshot-store + reader | See roadmap |
| `features/sprint` | Period, goal, scope, % Approved→Closed | api-client (iterations) | Needs API |
| `features/roadmap` | Epics/Features → sprint delivery links | api-client | Needs API |
| `features/history` | Movements, blocks, scope change, trends | snapshot-store + api `updates` | Hybrid |

### 2.3 How modularization ships without a bundler (MV3 constraint)

Manifest V3 content scripts can list multiple files; they share one scope in load
order. The safe, zero-tooling path:

1. Split `content.js` into ordered files under the same content-script entry:
   `js: ["src/core/i18n.js", "src/core/utils.js", "src/data/board-dom-reader.js", "src/features/wip/index.js", "content.js"]`.
   Load order replaces imports; each file attaches to a single namespace object
   (e.g. `window.WIPBoard = window.WIPBoard || {}`), avoiding globals leakage.
2. The popup can adopt native ES modules (`<script type="module">`) because the popup
   is an extension page, not an injected content script.
3. Only migrate when covered by tests (see `TEST_STRATEGY.md`). The first increment
   extracts **pure** functions (i18n, normalization, WIP math) that are trivial to
   test and cannot change board behavior.

This keeps the "no unnecessary technology substitution" constraint: no webpack, no
TypeScript required to start; those remain optional future decisions.

---

## 3. Data access strategy

Two complementary sources, chosen per signal by availability and cost:

1. **DOM reader (always available, zero permission cost).** Powers live WIP and
   card alarms exactly as today. Fragile to Azure markup changes.
2. **Read-only REST client (opt-in).** A content script executes in the
   `dev.azure.com` / `*.visualstudio.com` origin, so a same-origin `fetch` to
   `/<org>/<project>/_apis/...` reuses the signed-in session cookie. No PAT, no
   credential is ever stored in code or config. See `DATA_ACCESS_SPIKE.md` for the
   feasibility evidence and the exact endpoints.

Delivery modules prefer the API when enabled (richer, reliable, history via
`asOf` / `/updates`), and degrade to DOM + snapshots when the API is unavailable.

---

## 3bis. Audited risks in the current runtime (as-is)

These are observations from reading `content.js` today. None is fixed by this
document; they are recorded so later tasks can address them deliberately and so the
delivery modules do not inherit them.

### R1 — MutationObserver self-retrigger loop (RESOLVED — roadmap T0.5)

`observer` watches `document.body` with `{ childList: true, subtree: true }` and runs
`updateWipBoard` on every mutation (debounced 300 ms). The root cause was that
`updateWipBoard` mutated the DOM it was watching: `displayWip` rewrote the indicator
`innerHTML` **unconditionally**, emitting a `childList` record on every run even when
the HTML was identical, which re-armed the debounce and seeded the next run — a
persistent ~3 Hz background recompute (see `docs/AUDIT_R1_MUTATION_OBSERVER.md` §4).

**Fix (T0.5):** the write phase of `updateWipBoard` (card alarms + `displayWip`) now
runs inside `withObserverPaused()`, which disconnects the observer, performs the
writes, and reconnects on the next microtask. In addition, `setIndicatorHtml()` diffs
before writing so an unchanged indicator is never rewritten. WIP semantics are
untouched and the observer configuration is unchanged, so real Azure updates are still
observed. Proven by `test/mutation-observer-r1.test.js` (BEFORE vs AFTER) and
`test/runtime-stability.test.js`.

### R2 — DOM selector fragility (medium)

Every signal depends on Azure CSS classes (`.wit-card`, `.kanban-board-column-header`,
`.kanban-board-column`, `.field-container .label`/`.value`, `.identity-display-name`).
An Azure markup change silently breaks counting with no error. The `board-dom-reader`
(T0.4) centralizes these selectors so breakage has one place to fix and one fixture to
re-record.

### R3 — Tag fallback scans whole-page HTML (low/medium)

`buildSpaTagIndexFromPageSource` lowercases `document.documentElement.innerHTML` and
regex-scans it (cached 5 s) when the Tags field is not rendered on the card. This is a
heavy, markup-coupled fallback; it is bounded by the cache but should be isolated in
the reader and covered by a fixture test before any refactor.

### R4 — No persistence beyond settings (expected)

State is only `chrome.storage.sync` settings; there is no history store, so delivery
metrics require the new `snapshot-store` (T1.1). This is a gap to fill, not a defect.

---

## 4. Risk-aware migration order

1. Extract pure helpers to `src/core` + add unit tests (no behavior change).
2. Introduce `board-dom-reader` producing the normalized work-item model; WIP calc
   consumes it. Verified against the existing sample board HTML.
3. Add `snapshot-store` (storage.local) behind a flag. No UI yet.
4. Daily Commitment MVP on snapshots (DOM-only, no API dependency).
5. Add `ado-api-client` behind a flag; Sprint Intelligence read-only.
6. Roadmap + History once API shape is confirmed in the target tenant.

Each step is independently shippable and reversible, and none alters WIP semantics.

---

## 5. Non-goals / preserved decisions

- Child-task badge enrichment stays out of scope (per `AGENTS.md`).
- No credentials in the repo or in `chrome.storage`.
- No change to the WIP special-person block rule or block-tag rule semantics.
- No forced adoption of a bundler, framework, or TypeScript to deliver early value.
