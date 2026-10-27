# Daily Commitment — T1.3 (+ T1.4 projection) report

> Scope: let the user, from a captured snapshot (T1.2), record the daily
> COMMITMENT per work item (the expected destination column by the next daily),
> then compare the PLAN against what ACTUALLY happened (current board state) and
> project the difference in the existing panel. No WIP semantics changed,
> Manifest V3 preserved, MutationObserver (R1 fix) untouched. No commits/pushes
> were made by this task.

## 1. Pre-flight stability verification (before touching the runtime)

| # | Check | Result |
|---|---|---|
| 1 | Reviewed `AGENTS.md` + roadmap + architecture + test strategy + T1.2 report | Done |
| 2 | Ran the full suite before changes | **109 tests pass** (`node --test`) |
| 3 | Manifest V3 integrity | `manifest_version: 3`, valid JSON, `storage` permission + host_permissions intact |
| 4 | MutationObserver R1 fix still valid | `withObserverPaused()` + `setIndicatorHtml()` diff-guard present and unchanged; `test/mutation-observer-r1.test.js` green (6 tests) |
| 5 | Effective changes verified by git diff, not timestamps | Baseline working tree clean (`git status`); all edits reviewed via `git diff` |
| 6 | Pending browser validation documented | See §6 below |

## 2. Files modified / added

| File | Change |
|---|---|
| `src/data/daily-commitment.js` | **Added.** Pure, Chrome-free + DOM-free engine (`WIPBoardDailyCommitment`): `buildCommitmentItems` shapes commitment input from a base snapshot + expected columns; `compareCommitment` classifies plan vs actual (`reached`/`behind`/`beyond`/`off-track`/`missing`) using flow order. Never mutates inputs; no new store. |
| `manifest.json` | `content_scripts[].js` now also loads `src/data/daily-commitment.js` (dependency before `content.js`). |
| `content.js` | Added the Daily Commitment sub-section inside the existing §1d snapshot panel: per-item expectation input, Save/compare actions, per-item status badges + summary, all EN/PT. Added the `WIPBoardDailyCommitment` binding, handlers and CSS. No WIP math touched. |
| `docs/PRODUCT_ROADMAP.md` | T1.3 and T1.4 marked DONE with status + pending-validation notes. |
| `test/daily-commitment.test.js` | **Added.** 19 tests covering all T1.3-mandatory scenarios. |

## 3. How planned vs realized is calculated

1. **Base** — the last captured snapshot (T1.2) gives each item's `startColumn`.
2. **Plan** — the user declares, per stable id, an `expectedColumn`.
   `buildCommitmentItems` emits `{ id, startColumn, expectedColumn, assignee? }`,
   exactly the shape `WIPBoardSnapshotStore.saveCommitment` / `reviseCommitment`
   consume. Re-saving a plan for the same board becomes a **revision** (prior
   plan archived; history preserved), not a duplicate.
3. **Realized** — the CURRENT board, read through the same capture pipeline
   (`WIPBoardSnapshotCapture.buildCapture`) so ids/columns match the plan.
4. **Classification** (`compareCommitment`), per committed item:
   - `reached` — actual column equals the expected column (accent/case tolerant).
   - `behind` — actual column is earlier than expected in flow order.
   - `beyond` — actual column is later than expected in flow order.
   - `off-track` — not in the expected column but flow order is unknown; a
     direction is never guessed.
   - `missing` — item no longer on the board; never inferred as delivered.
   Flow order comes from the realized state's `columns` structure (each column
   carries an `order`) or an explicit `columnOrder` option.

Items **without** a commitment are never part of the comparison.

## 4. How the hard constraints are honored

- **Reuses the existing store.** Commitments persist through
  `WIPBoardSnapshotStore` (versioned commitments already supported); no second
  store was created.
- **WIP vs delivery isolation.** `daily-commitment.js` reads/writes no WIP number.
  The panel sub-section is visually and logically separate from the WIP indicator;
  the WIP count and its code path are untouched.
- **No work-item mutation.** The engine and the panel only read the board model
  and write to `chrome.storage.local`. Nothing edits an Azure DevOps work item.
- **Explicit actions only.** Save and compare run solely from button clicks;
  nothing fires from a DOM mutation. The sub-section is mounted inside the paused
  observer write phase and writes via the diff-guard, so the R1 fix is intact.
- **Scope isolation.** Commitment and snapshot reads use the same
  org/project/team/board scope resolver (`resolveSnapshotScope`); different boards
  never mix.
- **Local, not shared.** The panel keeps the existing note that data lives only on
  this browser.
- **Bilingual.** Every new label, message and status word has EN and PT entries.
- **Missing-item honesty.** A committed item absent from the board is surfaced as
  `missing`, not silently treated as done.

## 5. Tests executed

Command: `node --test` (single-run; the project's `npm test`).

Result: **128 tests pass, 0 fail** (109 prior + 19 new). New file
`test/daily-commitment.test.js` covers, 1:1 with the task list:

1. Recording a commitment per item (`startColumn` derived from the base snapshot;
   `expectedColumn` from the plan; array/object/Map expectation inputs).
2. Persistence and retrieval of commitments via the existing store, including
   survival across a reload (new store instance over the same storage).
3. Planned vs realized comparison: `reached`, `behind`, `beyond`, plus accent/case
   tolerance, `off-track` when order is unknown, and explicit `columnOrder`.
4. Isolation between different boards (no cross-scope mixing).
5. An item without a commitment never enters the comparison; empty commitment ->
   empty comparison.
6. A committed item that vanished from the board -> `missing` (never delivered).
7. Commitment versioning: revision bumps, prior plan archived, latest revision is
   what the comparison uses.
8. End to end: base snapshot -> commitment -> later snapshot comparison.
9. Module hygiene: no `document`, no `MutationObserver`, no `chrome.`, no
   `innerHTML` in the engine source.

## 6. Pending real-browser (Chrome) validation checklist

The automated suite cannot drive a live Chrome/Azure session. The following must
be executed manually and are **NOT yet done**:

- [ ] Load the unpacked extension in `chrome://extensions` with no console errors.
- [ ] On a configured Azure DevOps board, the snapshot panel shows the new
      "Daily commitment (plan vs actual)" sub-section below the snapshot actions.
- [ ] Capture a snapshot first, then enter lines like `620906: Code Review` and
      click "Save commitment"; a success message reports the item count.
- [ ] Saving again on the same board reports a revision (not a duplicate), and the
      prior plan is preserved in history.
- [ ] "Plan vs actual" lists each committed item with expected → actual columns
      and a status badge (reached/behind/beyond/off-track/missing) plus a summary.
- [ ] An item moved exactly to its expected column shows `reached`; one short of it
      shows `behind`; one past it shows `beyond`.
- [ ] A committed id removed from the board shows `missing` (not delivered).
- [ ] Ids not present on the base snapshot are reported as ignored, not saved.
- [ ] The WIP indicator number and behavior are unchanged; a single external board
      change still triggers exactly one recompute (R1 fix intact).
- [ ] Language toggle (EN/PT) updates every commitment label, button, status word
      and summary.
- [ ] A commitment saved on one board/team does not appear on another.

> No claim of real-Chrome testing is made here; the checklist above is the
> explicit record of what remains.

## 7. Limitations

- The expectation input is a lightweight `id: column` textarea rather than a rich
  per-card picker. This keeps the UI minimal and avoids a competing surface; a
  card-level picker is a possible future refinement.
- "Reached/behind/beyond" depends on the board exposing a column order. When the
  realized state has no column structure and no explicit order is supplied, the
  verdict is the conservative `off-track` instead of a guessed direction.
- The realized state is the CURRENT board capture; comparing two historic
  snapshots directly (base vs a chosen later snapshot) is supported by the pure
  engine but not yet surfaced as a separate panel action.
- "One commitment per board" is the current panel model (re-save = revision);
  multiple concurrent commitments per board are supported by the store but not
  exposed in the UI.
