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
