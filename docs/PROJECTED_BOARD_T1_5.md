# Projected Board — T1.5

> Status: implemented (automated tests green). Real-browser validation against a
> live Azure DevOps board is still PENDING (see the Chrome checklist below).
>
> Code comments stay in English. User-facing strings stay bilingual (EN / PT-BR).
> No existing feature is removed and WIP rule semantics are preserved.

---

## 1. What this adds

A read-only SIMULATION of how the board should look at end of day if every saved
commitment is honored. It compares:

- the INITIAL board (the selected snapshot, as captured), and
- the PROJECTED board (after the committed items move to their destination column).

Worked example (the canonical one from the task):

```
Snapshot (initial)        Commitment              Projected board
  HO:     #100 #101 #102    #100: HO -> Closed       HO:     #102
  Closed: #90               #101: HO -> Closed       Closed: #90 #100 #101
```

The projection NEVER changes Azure DevOps. It is math over stored data only.

---

## 2. Engine — `src/data/projected-board.js` (`WIPBoardProjectedBoard`)

A pure, Chrome-free and DOM-free module. One public entry point:

```js
project(baseSnapshot, commitment, options) -> projection
```

### Inputs

| Argument | Shape | Notes |
|---|---|---|
| `baseSnapshot` | `{ items:[{id,column,...}], columns?:[{id,name,order,isDoneColumn}], source?:{complete} }` | The store snapshot record (T1.1/T1.2). Authoritative baseline. |
| `commitment` | `{ items:[{id,startColumn,expectedColumn}] }` | A saved commitment (T1.3/T1.4). Only `expectedColumn` destinations are applied. |
| `options.columns` | `(string\|{name,order})[]` | Optional explicit column order override. |

### Output (`projection`)

```js
{
  columns: [{
    name, order, isDoneColumn,
    id?,                         // present when the board exposes a column id
    initialCount, projectedCount, delta,
    initialIds: [id...],         // snapshot occupants
    projectedIds: [id...],       // occupants after the simulation
    items: [{ id, movedIn, movedOut, fromColumn, toColumn }],
    isOrphan?                    // true for an appended column holding items whose
  }],                            //   snapshot column was not in the resolved set
  moves: [{ id, fromColumn, toColumn }],              // valid, effective moves
  noOps: [{ id, column }],                            // destination == origin
  invalidDestinations: [{ id, fromColumn, requested }], // unknown destination
  unknownCommittedIds: [id...],                       // committed but not in baseline
  summary: {
    snapshotItemCount, committedCount, plannedMoveCount,
    noOpCount, invalidDestinationCount, unknownCommittedCount
  },
  reliability: { complete, reasons: [ 'INCOMPLETE_SNAPSHOT' | 'UNKNOWN_COMMITTED_IDS' | 'INVALID_DESTINATIONS' ] }
}
```

### Guarantees (contract)

- Inputs are never mutated (a deep-frozen snapshot can be projected).
- Stable ids preserved; an id never appears in two columns.
- Duplicate snapshot ids collapse to one placement; duplicate committed ids
  collapse to the first destination.
- Only an explicit, VALID destination that DIFFERS from the origin moves an item.
- A destination equal to the origin is a no-op (counted in `noOps`, not `moves`).
- A destination that is not a real board column leaves the item in place and is
  reported in `invalidDestinations`.
- Columns come from real board data (snapshot/commitment/explicit order), or are
  derived from the item columns when no structure is supplied — never hardcoded.
- A committed id absent from the baseline is reported, never materialized.
- Item conservation holds: total initial count == total projected count.

---

## 3. UI integration

The projected view is a new sub-section inside the existing Daily Snapshot panel
(`#wip-snapshot-panel`), below the Daily Commitment picker. It reuses the panel
chrome, the `withObserverPaused()` / `setIndicatorHtml()` R1 primitives and the
same scope resolution as snapshot/commitment.

- "Projected board" button computes the projection from the LATEST snapshot and
  the ACTIVE (latest-revision) commitment of the SAME board scope.
- An Initial / Projected toggle switches the rendered view from memory (no
  recompute).
- Each column shows its name, the card count for the active view, and on the
  projected view a +/- delta badge.
- Cards that moved into a column on the projected view are highlighted and show
  their origin column ("from HO").
- A summary line reports snapshot card count, number of commitments and planned
  changes.
- A persistent "simulation only" note states no work item is moved in Azure.
- A reliability warning line appears when the projection is not fully reliable.
- All strings are localized EN/PT.

### Data-source discipline

- The baseline is the stored snapshot; destinations come from the stored
  commitment. The live board is NOT used to substitute missing snapshot data.
- When no commitment exists for the board, an informative empty state is shown
  (the initial board is still viewable); an old/foreign plan is never reused.

---

## 4. Metrics

Exposed by the engine and surfaced in the UI:

- Total cards in the snapshot (`summary.snapshotItemCount`).
- Number of commitments (`summary.committedCount`).
- Cards with a planned change (`summary.plannedMoveCount`).
- Initial and projected totals per column, plus per-column variation (`delta`).

These are DELIVERY/projection metrics. They are kept entirely separate from the
WIP number: nothing in the projected board reads or writes the WIP calculation.

---

## 5. Risks and limitations

- Single active commitment per board: the store keeps one logical commitment per
  board (new daily plans are revisions). The projection uses the latest revision;
  it does NOT render a history of past daily plans (historical comparison is
  explicitly out of scope for T1.5, planned for later).
- The projection is only as good as the baseline snapshot. An incomplete snapshot
  is flagged (`reliability.reasons` contains `INCOMPLETE_SNAPSHOT`) but cannot be
  repaired from the live board by design.
- A card that vanished from the live board is NOT inferred as done here; the
  projection is based on the snapshot, and the "missing" judgement lives in the
  commitment comparison (T1.3), not in the projection.
- Column matching is case/accent-insensitive by display name. Two real columns
  that normalize to the same name would be merged; Azure boards do not allow
  duplicate column names, so this is not expected in practice.

---

## 6. Chrome manual homologation checklist (NOT yet executed)

Validate in a real Chrome against a real Azure DevOps board:

1. Extension loads in `chrome://extensions` with no errors after adding
   `src/data/projected-board.js` to the manifest.
2. On a configured board, open the Daily Snapshot panel; the "Projected board
   (simulation)" sub-section is visible below the commitment picker.
3. Capture a snapshot, choose work items with destinations, save the commitment.
4. Click "Projected board": the projected view shows committed items in their
   destination columns and leaves uncommitted items in place.
5. The summary line reports the correct snapshot card count, commitments and
   planned changes; per-column counts and +/- deltas are correct.
6. Toggle Initial / Projected: the board switches without flicker and without a
   WIP recompute; moved cards are highlighted with their origin column only on
   the projected view.
7. With no commitment saved, the section shows the informative empty state and
   the initial board is still viewable.
8. Switch the language (EN/PT): every label, button, summary and warning in the
   projected section is translated.
9. The floating WIP indicator number is unchanged throughout, and an idle board
   triggers no background recompute (R1 preserved).
10. No work item on the board is moved or edited by any projected-board action.

---

## 7. Tests

- `test/projected-board.test.js` (18): engine behavior — no commitments, one and
  several commitments, no-change items, multiple columns, destination == origin,
  invalid destination, duplicate snapshot/commitment ids, committed id absent
  from baseline, incomplete snapshot reliability, case/accent-insensitive
  destination matching, per-column counters/deltas, flow-order preservation,
  input immutability (incl. deep-frozen input), isolation between boards via the
  real store, revisions not mixing days, derived-columns fallback.
- `test/projected-board-r1.test.js` (4): R1 regression — diff-guarded writes,
  projection computed only on explicit action, toggle does not recompute,
  observer primitives/config unchanged.
- `test/i18n-parity.test.js` (5): EN/PT parity for the whole I18N pack including
  the new projected keys, placeholder-token parity, no empty strings.

Full suite: **178 tests pass** (151 prior + 27 new).
