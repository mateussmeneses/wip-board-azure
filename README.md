# Azure DevOps - Board WIP Monitor

Chrome extension to monitor Azure DevOps board WIP with configurable scope, configurable rules, and configurable visual alerts.

## What it does

The extension reads visible cards from configured WIP columns, calculates total WIP, and displays a floating indicator on top of the board. It can also:

- Show per-column bottleneck details.
- Highlight risky cards by aging and target date thresholds.
- Apply an optional special rule for selected people and selected tags.

## Multi-team support

The extension is now designed to work across different teams and boards:

- No hardcoded `Maintenance/Features` dependency.
- No hardcoded project or organization in runtime logic.
- Board matching is controlled in popup settings.
- Optional route filter is configurable in popup settings.

## Configurable settings

All core behaviors are configurable in the popup:

- Language toggle (English or Portuguese) for popup and runtime board messages.
- Team-size mode (`2 * team + 1`) or direct fixed WIP limit.
- Board URL keyword.
- Optional board route keyword.
- WIP columns (comma-separated).
- Toggle: details panel.
- Toggle: card highlighting.
- Toggle: special rule.
- Special people list.
- Special tag prefix (default suggestion: `#spa`).
- Block tag (default suggestion: `#blck`).
- Aging thresholds: warning, high, critical.
- Target date warning threshold in days.

## Special rule semantics

- Special people + special tag prefix:
For each configured person, cards that match the configured special tag prefix are grouped as one WIP block for that person. Cards without the special tag still count individually.

- Block tag (`#blck` by default):
Cards containing the configured block tag are excluded from card highlight alarms. They are not excluded from WIP counting.

## Aging and target date semantics

- Aging thresholds (warning/high/critical):
When a card reaches each configured aging level, visual highlighting severity increases accordingly.

- Target date warning days:
If a card has a Target Date and remaining days are less than or equal to the configured threshold, the card is flagged as alert. Overdue cards are always flagged.

## How to load

1. Open Chrome in Developer Mode.
2. Go to `chrome://extensions`.
3. Click `Load unpacked`.
4. Select this project folder.
5. Open any Azure DevOps board URL that matches the manifest scope.
6. Open extension popup and save your board-specific configuration.

## Technical notes

- The extension depends on Azure DevOps DOM selectors and card field rendering.
- If Azure UI structure changes, selectors may need updates.
- Tag extraction includes a fallback parser for serialized page content when tags are not visible on cards.


## Current source layout

```text
src/
  api/            Azure DevOps read-only client (disabled by default)
  core/           WIP logic and board route identity
  data/           DOM reader and storage/capture adapters
  features/
    daily/        Commitment, picker, projections, comparison, history
    sprint/       Scope, baseline, progress, trends
  ui/             Panel and popup CSS, isolated form contrast
test/             Node unit/integration tests and sanitized DOM fixtures
docs/             Architecture, audits, roadmap and design notes
```

### Snapshot accuracy and multiple boards

Snapshot history is scoped to the **actual Azure board route** (including team and board), not the generic WIP URL keyword. Two roadmap boards and one maintenance board therefore maintain independent histories, provided they have distinct board routes. A capture reports **visible DOM work items** separately from the count displayed in Azure's column header. Differences are flagged as incomplete; DOM virtualization, filters and hidden cards can prevent a full capture. The extension does not invent missing work-item IDs. Historical snapshots stored under the previous generic-key scope remain in browser local storage and are not automatically attributed to a new board.
