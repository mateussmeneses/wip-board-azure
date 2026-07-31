# AGENTS.md

## Project Identity
- Name: Azure DevOps - Board WIP Monitor
- Type: Chrome Extension (Manifest V3)
- Main goal: monitor WIP in Azure DevOps boards with configurable rules and visual alerts.
- Current repository visibility: public GitHub repository.
- Public repo reference: https://github.com/mateussmeneses/wip-board-azure

## Why This Project Exists
This extension was created to help delivery teams monitor WIP limits directly on Azure DevOps boards, reducing manual counting and making bottlenecks visible in real time.

Primary outcomes:
- Fast WIP visibility on the board screen.
- Configurable rules per team/project.
- Visual alarms for risk signals (aging and target date proximity).

## Current Product Objectives
1. Be reusable by multiple teams without hardcoded board paths.
2. Keep all relevant behavior configurable through the popup.
3. Keep comments and maintainability in English.
4. Provide bilingual UX (English and Portuguese) through a language toggle.

## Important Historical Decision
A child-task badge feature was intentionally removed.

Reason:
- Azure DevOps child relations were not available in accessible page payloads for this extension context.
- API-based fallback required auth/session conditions not reliably available to the extension runtime.

Current status:
- Child badge enrichment is not part of the product scope right now.
- Focus is on reliable WIP monitoring and configurable alarms.

## High-Level Architecture
- `manifest.json`
  - Defines extension metadata and URL scopes.
  - Content script runs on Azure DevOps board routes.
- `popup.html`
  - User configuration UI.
- `popup.js`
  - Loads/saves settings in `chrome.storage.sync`.
  - Handles language toggle and popup i18n.
- `content.js`
  - Reads board DOM.
  - Calculates WIP from configured columns.
  - Applies special rule logic.
  - Renders floating indicator and optional detail panel.
  - Applies card visual alerts.

## Runtime Features
1. WIP calculation modes
- Team-size formula: `2 * team + 1`
- Direct fixed WIP limit

2. Board targeting
- Board URL keyword (required)
- Optional route keyword (optional)

3. WIP scope
- WIP columns list (comma-separated)

4. Special rule
- Special people list
- Special tag prefix (default suggestion: `#spa`)
- Rule behavior: for each configured person, cards matching the special tag prefix count as one WIP block for that person.

5. Block tag behavior
- Configurable block tag (default suggestion: `#blck`)
- Block-tag cards are excluded from card highlight alarms.
- Block-tag cards still count in total WIP.

6. Alert thresholds
- Aging warning
- Aging high
- Aging critical
- Target date warning days

7. UX language
- English / Portuguese toggle
- Popup and board runtime messages are localized.

## Configuration Keys (chrome.storage.sync)
- `language` (`en` or `pt`)
- `useEquipe` (boolean)
- `equipeSize` (number)
- `directWip` (number)
- `showDetails` (boolean)
- `highlightCards` (boolean)
- `specialRuleEnabled` (boolean)
- `boardName` (string)
- `boardPathFilter` (string)
- `specialPeople` (string[])
- `wipColumns` (string[])
- `specialTagPrefix` (string)
- `blockTag` (string)
- `agingWarningDays` (number)
- `agingHighDays` (number)
- `agingCriticalDays` (number)
- `targetDateWarningDays` (number)
- `hasInitializedConfig` (boolean)

## Known Constraints
1. DOM dependency
- The extension relies on Azure DevOps DOM structure and selectors.
- If Azure updates markup/classes, selectors may require maintenance.

2. Data availability
- Runtime logic is based on visible board/card information and available page data.

3. Scope matching
- Board availability is controlled by `manifest.json` match patterns and runtime keyword matching.

## Coding Guidelines for Future AI Edits
1. Keep all code comments in English.
2. Prefer configurable behavior over hardcoded values.
3. Preserve existing storage keys unless migration is intentionally planned.
4. Keep popup validation messages localized in both `en` and `pt`.
5. Do not reintroduce removed child-task enrichment unless data-access constraints are solved first.
6. Make minimal, safe changes and avoid unrelated refactors.

## Manual Validation Checklist
After changes, validate:
1. Extension loads in `chrome://extensions` without errors.
2. Popup opens and saves configuration.
3. Language toggle updates popup labels and board runtime messages.
4. WIP indicator appears only on configured board/route.
5. WIP count updates after board changes.
6. Special rule works for configured people + tag prefix.
7. Block tag suppresses card alarm highlighting but does not remove WIP count.
8. Detail panel toggle works when enabled.

## Recommended Entry Point for New AI Sessions
1. Read this file first (`AGENTS.md`).
2. Read `README.md` for product-level overview.
3. Inspect `popup.js` and `content.js` for behavior.
4. Run a focused diff-based change and revalidate with the checklist above.
