# Integration report — T0.3 + T0.4 (modules wired into the runtime)

> Scope: make `content.js` consume the already-extracted pure module
> (`src/core/wip-logic.js`, `WIPBoardCore`) and the board reader
> (`src/data/board-dom-reader.js`, `WIPBoardReader`), removing the duplicated
> inline logic where equivalence is proven, without changing any WIP semantics or
> the MutationObserver. No commits/pushes were made by this task.

## 1. Files modified

| File | Change |
|---|---|
| `content.js` | Binds pure helpers from `WIPBoardCore`; removes the inline duplicates (`getLanguageCode`, `formatMessage`, `normalizeText`, `normalizeColumnName`, `isConfiguredWipColumn`, `getCardSeverityClass`, `getHeaderColumnDisplayName`, `isCardVisible`, inline limit/special-reduction/target-date math). Drives the board scan from the `WIPBoardReader` model (columns, order, stable column id, visibility, card→column mapping) via new bridge helpers `readBoardModel`, `buildLiveCardIndex`, `resolveLiveCard`. Per-card rule analysis still runs on the live DOM node. |
| `manifest.json` | `content_scripts[].js` now loads `src/core/wip-logic.js`, then `src/data/board-dom-reader.js`, then `content.js` (dependencies before consumer). |
| `docs/PRODUCT_ROADMAP.md` | T0.3 and T0.4 marked DONE with status notes. |
| `docs/AUDIT_R1_MUTATION_OBSERVER.md` | §7 added: runtime mutations after integration, which are observable, which cause recurring recomputes, and the reproducible test reference. Observer behavior unchanged. |

## 2. Files added

| File | Purpose |
|---|---|
| `test/fixtures/board-special-rule.html` | Sanitized fixture exercising special-person reduction, block tag, prefix/suffix tag variations, a non-WIP (Closed) column. |
| `test/wip-runtime-integration.test.js` | Regression + integration tests: a legacy pre-integration scan and the integrated (reader+core) scan are asserted equal across every WIP scenario. |
| `test/mutation-observer-r1.test.js` | Deterministic reproduction of R1 (self-retriggering indicator rewrite) and the acceptance target for the future fix. |

## 3. Behavior before vs after

The WIP number, per-column breakdown, limit math, special-person block reduction,
block-tag counting, and aging/target-date alarm classification are **unchanged**.
This is enforced by `test/wip-runtime-integration.test.js`, which runs both the
pre-integration algorithm and the integrated one on the same fixtures and asserts
`deepEqual` on `{ finalWip, limit, totalCards, columnsBreakdown }` for:

- WIP normal / exceeded (direct limit).
- Team-size limit (`2*team+1`) and direct limit.
- Special rule per person (tagged cards collapse to one block) and special rule off.
- Cards without assignee (no crash, same result).
- Blocked cards (still counted in WIP).
- Hidden/filtered cards excluded; columns outside the WIP set ignored.
- Boards with different column counts (per-column breakdown).
- Dynamic card change (un-hiding a filtered card updates the count equivalently).
- Config change (switching limit mode).
- Duplicate ids across columns (each occurrence counted).

The only intentional structural change is *how* the data is obtained (normalized
reader model instead of ordinal header/body pairing); the numbers it produces are
identical.

## 4. Tests executed

Command: `node --test` (single-run; the project's `npm test` script).

Result: **45 tests, 45 pass, 0 fail** (3 files: `wip-logic.test.js`,
`board-dom-reader.test.js`, `wip-runtime-integration.test.js`,
`mutation-observer-r1.test.js` plus the mini-dom helper self-check).

## 5. Manual checklist (AGENTS.md) — executed vs pending

The automated suite cannot drive a real Chrome/Azure session, so the AGENTS.md
manual checklist is split by what the environment allowed:

| # | Check | Status | Evidence / why |
|---|---|---|---|
| 1 | Loads in `chrome://extensions` without errors | PENDING (manual) | Requires Chrome. Mitigated: `node --check content.js` passes, `manifest.json` is valid MV3 with correct load order, all referenced files exist. |
| 2 | Popup opens and saves configuration | PENDING (manual) | `popup.js`/`popup.html` untouched by this task. |
| 3 | Language toggle updates popup + board messages | PARTIAL | `WIPBoardCore.formatMessage`/`getLanguageCode` covered by unit tests; the `I18N` packs in `content.js` are unchanged. End-to-end toggle needs a browser. |
| 4 | WIP indicator appears only on configured board/route | PENDING (manual) | `isAllowedBoard` logic unchanged; needs a live URL. |
| 5 | WIP count updates after board changes | EXECUTED (equivalent, automated) | `wip-runtime-integration.test.js` "dynamic card change" proves the integrated count matches the legacy count after a card becomes visible. Live MutationObserver timing still needs a browser. |
| 6 | Special rule works for people + tag prefix | EXECUTED (automated) | "special rule per person" + prefix/suffix variations (`#spa`, `#spa.ui`, `#spaapi`). |
| 7 | Block tag suppresses alarm but keeps WIP count | PARTIAL | "blocked card still counts in total WIP" is automated; the *alarm suppression* (`applyCardAlarm` early return on block tag) is DOM-styling and verified by reading `content.js` (logic unchanged), not yet by a browser. |
| 8 | Detail panel toggle works when enabled | PENDING (manual) | Panel rendering (`displayWip`/drag/click) unchanged; needs a browser. |

## 6. Risks and remaining limitations

- **Special-tag visible-field detection depends on label/value whitespace.** The
  tag regex requires a boundary before the tag, so `Tags#spa` (no separator)
  doesn't match the visible field; production relies on the serialized-HTML
  fallback (`cardHasSpaTagFromSource`), which is preserved on the live node and is
  **not** reproduced in the reader model. This is pre-existing behavior, kept
  intentionally; documented here because the fixtures must include a separator to
  exercise the visible-field path.
- **Cards without a `data-itemid` (theoretical).** The legacy scan counted every
  `.wit-card` node and applied alarms to it even if it had no `data-itemid`. The
  integrated path still **counts** such a card (the reader keeps it with `id:null`),
  but `resolveLiveCard` cannot map it to a live node, so its alarm styling would be
  skipped. Azure always renders `data-itemid` on real cards, so this does not occur
  in practice; documented here as a known, practically-irrelevant divergence rather
  than adding index-based fallback complexity that the reader was built to remove.
- **No real browser verification in CI.** The DOM/observer end-to-end checks
  (table above) still need the manual AGENTS.md run.
- **R1 (observer self-retrigger) is unchanged and still present** by design of this
  task; see `docs/AUDIT_R1_MUTATION_OBSERVER.md` §7 and
  `test/mutation-observer-r1.test.js`.

## 7. Evidence of real integration

- `manifest.json` loads `WIPBoardCore` and `WIPBoardReader` before `content.js`.
- `content.js` binds `Core.*` at module top and calls `Reader.readBoard(document)`
  in `updateWipBoard`; the former inline helpers no longer exist in the file.
- The integration test imports the **same** module files the extension ships and
  reproduces the content.js algorithm, proving equivalence.

## 8. Recommended next increment

**R1 fix as its own task** (roadmap-aligned, now unblocked): wrap the render tail of
`updateWipBoard` in an observer pause, or add the diff-before-write guard the reader
now makes trivial (a stable render signature). Turn
`test/mutation-observer-r1.test.js` green and add a live single-change recompute
assertion. After that, proceed to **T1.1 `snapshot-store`** on `chrome.storage.local`.
