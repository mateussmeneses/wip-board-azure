# Repository audit — UI, Snapshot and board identities (2026-10-27)

## Fixes delivered
- Scoped light form controls to extension UI; Azure DevOps inputs are unaffected.
- Extracted monolithic panel styles and popup styles into src/ui.
- Moved Daily and Sprint pure feature engines into src/features/{daily,sprint}; preserved module load order in Manifest V3.
- Snapshot route identity is derived from actual board/team URL. Generic WIP keyword is no longer a snapshot storage key.
- Reader now handles multiple swimlane body rows per column, flags structural mismatches and compares Azure header totals with observed unique visible cards.
- Snapshot persistence distinguishes observed count from reported board header count; no inferred work-item IDs.
- Removed raw board HTML export (1.4 MB) from the current tree. It is superseded by sanitized fixtures, and the original remains recoverable via Git history.

## Known limitations and follow-up risk
- Azure DevOps DOM changes, virtualization and active filters may prevent complete counts. The header count is a reconciliation aid, NOT a substitute for captured item IDs.
- Snapshot history written before the URL-based scoping fix used generic configuration keys. It is preserved in local storage but not automatically migrated because the originating board cannot be established reliably.
- Route identity relies on the board URL; if two distinct boards use identical canonical routes, they cannot be distinguished without a stable additional board identifier.
- Local Chrome and authenticated Azure API end-to-end homologation remains scheduled for the end of the feature roadmap.
- The REST client is not yet wired into live Sprint/Roadmap UX. Do not describe its mocked tests as live access.
- The WIP calculation retains the existing interpretation of configured columns; Snapshot total is a different metric.

## Deferred refactors
- Incrementally split remaining large content.js rendering sections into view modules only with executable integration tests.
- Prefer browser-driven UI tests before removing existing DOM fallbacks or version/update checks.
- Do not remove stores or retention/migration logic without a data migration strategy.

## QA acceptance
1. Three board routes (two roadmaps + maintenance) produce three isolated snapshot histories.
2. Multiple swimlanes are aggregated by logical column and deduplicated by work-item ID.
3. When Azure column header count != visible captured cards, the UI shows both and flags incomplete capture.
4. Text, select and textarea controls remain readable on a dark Azure theme.
5. All existing WIP, Daily and Sprint tests pass.
