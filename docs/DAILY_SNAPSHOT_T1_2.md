# Daily Snapshot Capture — T1.2 integration report

> Scope: integrate the `WIPBoardReader` normalized model with the
> `WIPBoardSnapshotStore` persistence layer to let a user explicitly capture,
> persist and review real board snapshots. First visible feature of Phase 1.
> No WIP semantics changed, Manifest V3 preserved, MutationObserver (R1 fix)
> untouched. No commits/pushes were made by this task.

## 1. Pre-flight stability verification (before touching the runtime)

| # | Check | Result |
|---|---|---|
| 1 | Reviewed `AGENTS.md` + roadmap + architecture docs | Done |
| 2 | Ran the full suite before changes | **88 tests pass** (`node --test`) |
| 3 | Manifest V3 integrity | `manifest_version: 3`, valid JSON, host_permissions + storage permission intact |
| 4 | MutationObserver R1 fix still valid | `withObserverPaused()` + `setIndicatorHtml()` diff-guard present and unchanged; `test/mutation-observer-r1.test.js` green |
| 5 | Effective changes verified by git diff, not timestamps | Baseline working tree clean (`git status`); all edits reviewed via `git diff` |
| 6 | Pending browser validation documented | See §6 below |

## 2. Files modified / added

| File | Change |
|---|---|
| `src/data/snapshot-capture.js` | **Added.** Pure, Chrome-free + DOM-free bridge: `WIPBoardReader` model → `WIPBoardSnapshotStore` input. Captures all columns, classifies done/approved roles without hardcoded names, drops `UNAVAILABLE` sentinels, computes a completeness verdict, never mutates the model. |
| `src/data/snapshot-store.js` | Snapshot record now carries an optional normalized `columns` array (id, name, order, role, isDoneColumn, count) so history can show per-column work-item counts. Additive; existing records/tests unaffected. |
| `content.js` | Added §1d Daily Snapshot panel: discrete collapsible bottom-right panel with Capture / View last / View history actions, EN/PT strings, success/failure messages. Panel mounted inside the existing `withObserverPaused()` write phase. Capture runs only on explicit click. |
| `manifest.json` | `content_scripts[].js` now also loads `src/data/snapshot-store.js` and `src/data/snapshot-capture.js` (dependencies before `content.js`). |
| `docs/PRODUCT_ROADMAP.md` | T1.2 marked DONE with status + pending-validation note. |
| `test/snapshot-capture.test.js` | **Added.** 21 tests covering all T1.2-mandatory scenarios. |

## 3. How the hard constraints are honored

- **No work-item mutation.** Capture only reads the already-available board model
  and writes to `chrome.storage.local`. `buildCapture` is proven read-only by a
  test asserting the input model is unchanged.
- **Local, not shared.** The panel shows a note that snapshots live only on this
  browser; nothing is presented as team-shared.
- **No automatic daily-commitment comparison.** Deferred to T1.3 as required.
- **No capture on DOM mutation.** Capture only fires from a button `click`
  handler. The panel's own creation/label refresh happens inside the paused
  observer write phase, so it cannot seed a recompute cycle.
- **Incomplete captures are never silent.** Empty board, hidden/filtered cards,
  duplicate ids and missing ids each set `complete: false`, surfaced both in the
  stored record (`source.complete`) and the panel message.

## 4. Column role identification (no hardcoded names)

- Terminal/"done" columns (e.g. Closed) come from the board's own `data-done`
  flag via the reader's `isDoneColumn` → role `closed`.
- The start-of-flow ("Approved"-like) role is opt-in via
  `approvedColumnKeywords`; with no keyword, no column is tagged — there is no
  built-in English assumption.

## 5. Tests executed

Command: `node --test` (single-run; the project's `npm test`).

Result: **109 tests pass, 0 fail** (88 prior + 21 new). New file
`test/snapshot-capture.test.js` covers, 1:1 with the task list:

1. Full-board capture (all columns, per-column counts, metadata).
2. Persistence and retrieval (columns + counts + recovered item columns).
3. Separation between different boards (scope isolation).
4. Captures at different times (both kept, newest first, timezone preserved).
5. Absence of mandatory data (invalid scope rejected; empty board incomplete).
6. Hidden cards / incomplete load (flagged incomplete, not counted present;
   duplicates collapsed and flagged).
7. Storage failures (`set`/`get` surfaced as `STORAGE_FAILURE`).
8. Page reload (a new store instance over the same storage still reads it).
9. Compatibility with the existing runtime model (unmodified reader shape).
10. No additional MutationObserver cycles (module is DOM/observer-free by
    structural assertion).

## 6. Pending real-browser (Chrome) validation checklist

The automated suite cannot drive a live Chrome/Azure session. The following must
be executed manually and are **NOT yet done**:

- [ ] Load the unpacked extension in `chrome://extensions` with no console errors.
- [ ] On a configured Azure DevOps board, the Daily Snapshot panel appears
      bottom-right and expands/collapses.
- [ ] "Capture snapshot" stores a snapshot and shows a success message with the
      item/column counts.
- [ ] Capturing on a board with an active filter / not-fully-loaded cards reports
      the capture as incomplete.
- [ ] "View last snapshot" shows the last capture's date/time, complete/incomplete
      badge and per-column counts.
- [ ] "View history" lists prior captures for the current board.
- [ ] Capturing does NOT modify any work item on the board.
- [ ] Reloading the page keeps previously captured snapshots.
- [ ] Language toggle (EN/PT) updates every panel label and message.
- [ ] A second capture on a different board/team does not appear under the first.
- [ ] The WIP indicator number and behavior are unchanged; a single external
      board change still triggers exactly one recompute (R1 fix intact).

> No claim of real-Chrome testing is made here; the checklist above is the
> explicit record of what remains.

## 7. Limitations

- Snapshot scope `organization`/`project` is derived from card work-item hrefs in
  the reader model; `team`/`board` are derived from the configured board keyword
  and optional route filter. On a board where no card exposes an href, capture
  refuses with a clear message rather than writing an ambiguous record.
- Per-column counts reflect VISIBLE items only; hidden/filtered cards are excluded
  from the present set and flag the capture incomplete (by design — a filtered
  card is never recorded as present, nor as a definitive absence).
- "One capture per day" dedup and planned-vs-observed daily comparison are
  intentionally out of scope for T1.2 (next: T1.3 Daily Commitment).
