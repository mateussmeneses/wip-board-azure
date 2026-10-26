# Audit — R1 MutationObserver recomputation cycle

> Scope: re-evaluation of risk **R1** from `docs/ARCHITECTURE.md` §3bis, requested
> as complementary audit of task T0.4. This document only analyzes and proposes a
> fix. It does **not** change `content.js` and is intentionally kept separate from
> the Board DOM Reader implementation.

## 1. What the original note claimed

`docs/ARCHITECTURE.md` recorded R1 as a *medium* risk and concluded that the
self-induced mutations "do **not** runaway" because the 300 ms debounce coalesces
them and the computation is idempotent, so the practical effect was described as
"an extra recompute cycle after every legitimate board change, i.e. wasted work
rather than an infinite loop."

This re-audit finds that conclusion **too optimistic**: there is a persistent,
self-sustaining recompute cycle even with no user activity on the board.

## 2. The observer and its write phase

```
// content.js §4
const observer = new MutationObserver(() => {
  clearTimeout(observerTimeout);
  observerTimeout = setTimeout(updateWipBoard, 300);   // debounce
});
observer.observe(document.body, { childList: true, subtree: true });
```

`updateWipBoard` runs inside `document.body` and performs these writes on the very
subtree the observer watches:

| Write site | Operation | Produces a mutation record? |
|---|---|---|
| `displayWip` → `applyWipIndicatorState` | `indicator.innerHTML = ...` every run | **Yes, always** (childList: old nodes removed, new nodes inserted) |
| `applyWipIndicatorState` | `indicator.className = ...`, `indicator.style.*` | Yes when the value changes (attributes) |
| `displayWip` | `indicator.dataset.clickable = ...` | Yes when it changes |
| `applyCardAlarm` | `classList.add/remove('card-alerta-*')`, `setAttribute/removeAttribute('title')` | Yes when state actually changes |

The indicator node is appended to `document.body`, so it is inside the observed
subtree.

## 3. Which mutations are caused by the extension itself

The decisive one is **`indicator.innerHTML = ...`**. Assigning `innerHTML`
unconditionally detaches all existing child nodes and inserts freshly parsed
ones, so it emits `childList` mutation records on **every** `updateWipBoard`
call — even when the rendered HTML string is byte-for-byte identical to what was
already there. The MutationObserver does not compare content; it reports the node
replacement.

The `classList` / `title` writes in `applyCardAlarm` are mostly idempotent
(re-adding a present class or removing an absent one emits no record), so they are
*not* the primary driver. They only contribute records when a card's alarm state
genuinely changes.

## 4. Is there a persistent cycle? Yes

Because the `innerHTML` write always emits a record, the sequence is:

```
updateWipBoard()  --> innerHTML rewrite --> childList mutation
     ^                                              |
     |                                              v
 setTimeout(300ms) <----------------- observer callback re-arms debounce
```

So on any configured board the extension recomputes roughly **once every ~300 ms
indefinitely**, with no user interaction. The 300 ms debounce caps the frequency
(it prevents a tight, CPU-pinning loop) but does **not** break the cycle: each
recompute seeds the next. The earlier "only after a legitimate change" framing is
incorrect — the indicator rewrite is itself a perpetual trigger.

### Severity re-rating

- Not an infinite tight loop (debounce bounds it to ~3 Hz).
- But a **persistent background recompute** that scans the board DOM, runs
  `getComputedStyle` per card, and (in the R3 path) can rebuild the whole-page tag
  index every 5 s. On large boards this is continuous wasted CPU and layout work
  for the life of the tab.
- Re-rated: **medium**, persistent (was described as transient).

## 5. Proposed safe fix (for a later, separately-tested task — not applied here)

The goal is to stop the observer from reacting to the extension's own writes,
without changing any WIP semantics or the characterization tests.

**Primary fix — pause the observer around the write phase:**

```js
function withObserverPaused(write) {
  observer.disconnect();
  try {
    write();
  } finally {
    // Reconnect on the next microtask so the just-written nodes are not
    // re-observed as "new" when observation resumes.
    Promise.resolve().then(() => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}
```

Wrap the mutation-producing tail of `updateWipBoard` (the `allWipCards.forEach(applyCardAlarm)`
+ `displayWip`) in `withObserverPaused(...)`. External board changes still trigger
recomputation; the extension's own writes no longer do.

**Defense-in-depth (either/both, independent of the primary fix):**

1. **Diff before writing.** Skip `innerHTML`/attribute writes when the computed
   content equals the current content (store the last rendered signature on the
   node and compare). This removes the no-op `innerHTML` rewrite that seeds the
   cycle even if the observer is briefly connected.
2. **Narrow the observation scope.** Observe the board container
   (`.kanban-board`) instead of `document.body`, and/or ignore mutations whose
   `target`/`addedNodes` are the indicator subtree (`#custom-wip-indicator`). This
   keeps the indicator's own churn out of the trigger path.

### Why this is safe

- No WIP math changes: the count, special-person reduction, and alarm thresholds
  are untouched. The existing characterization tests (`test/wip-logic.test.js`)
  continue to pass unchanged.
- Reversible and local: disconnect/reconnect is a well-defined DOM API with no
  persistence side effects.
- Must be covered by a regression test asserting that a single external board
  change triggers exactly one recompute (and that an idle board triggers none)
  before it ships — tracked as a follow-up task, not part of T0.4.

## 6. Recommendation

Address R1 as its own small task **after** `board-dom-reader` is wired into the WIP
path, so the reader can expose a stable render signature that makes the "diff
before writing" option trivial. Until then, R1 remains a known, bounded
inefficiency, not a correctness bug.

## 7. Post-integration note (module wiring task)

The module-integration task (roadmap T0.3/T0.4) wired `WIPBoardCore` and
`WIPBoardReader` into `content.js` but, per its own constraints, **did not change
the observer**. The behavior below is re-stated against the integrated runtime so
the later R1 fix starts from an accurate baseline.

### 7.1 Mutations the runtime itself produces

| Write site (integrated content.js) | Operation | Emits a record under the current observer config? |
|---|---|---|
| `displayWip` → `applyWipIndicatorState` | `indicator.innerHTML = ...` (unconditional) | **Yes, every run** (childList) |
| `applyWipIndicatorState` | `indicator.className`, `indicator.style.*` | Yes when the value changes (attributes — not watched, see below) |
| `displayWip` | `indicator.dataset.clickable` | Yes when it changes (attribute) |
| `applyCardAlarm` | `classList.add/remove('card-alerta-*')`, `title` attr | Only on genuine state change |

The reader integration did **not** add or remove any write site: the indicator is
still rebuilt via `innerHTML`, and card alarms are still applied to the live DOM
nodes resolved by `resolveLiveCard`.

### 7.2 Which of those are observable by the current configuration

The observer is `observer.observe(document.body, { childList: true, subtree: true })`.
It watches **only** `childList` (node add/remove), not `attributes`. Therefore:

- **Observable:** the `innerHTML` rewrite (it replaces child nodes) and the initial
  creation/append of `#custom-wip-indicator`.
- **Not observable:** `className`, `style`, `dataset`, and `title` attribute writes —
  they change attributes, and `attributes` is not enabled. `classList` add/remove on
  cards is likewise an attribute mutation and is **not** a `childList` record.

So the single observable self-mutation that matters is the indicator `innerHTML`
rewrite.

### 7.3 Which can cause recurring recomputation

Only the `innerHTML` rewrite. It fires a `childList` record on every
`updateWipBoard()` run even when the computed HTML is identical, which re-arms the
300 ms debounce and seeds the next run — a persistent ~3 Hz background recompute on
any configured board, with no user interaction (see §4).

### 7.4 Reproducible test

`test/mutation-observer-r1.test.js` reproduces the cycle deterministically (no DOM
engine needed): it models a node whose `innerHTML` setter always emits a
`childList` record and asserts that three identical renders emit three records
(problem present today), while a diff-before-write guard emits only one (the
acceptance target for the future fix). The observer itself is left unchanged by
this task; the test is red-by-design against the current render and documents the
exact condition the later fix must satisfy.
