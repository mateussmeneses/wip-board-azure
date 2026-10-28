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


## Snapshot columns without a header counter (2026-10-28)

Some terminal Azure DevOps columns (notably **Closed**) do not expose a numeric header counter. The Snapshot must not interpret this as an absent column or as evidence of incomplete capture. Each column always counts **unique visible DOM work-item IDs** in its correctly mapped bodies (including swimlanes). If the Azure header supplies a numeric total, that number is retained separately and compared with the DOM count. If there is no header counter, the Snapshot displays a **DOM-only card count** and no counter-mismatch validation is possible for that column. Existing structural/visibility issues (hidden cards, duplicate or missing IDs, ambiguous mappings) still produce an incomplete verdict. DOM-only does **not** establish that Azure loaded every work item: virtualization, filters and pagination remain coverage limitations.

Regression tests cover mixed counted/uncounted columns, Closed with visible cards, empty Closed, persisted counts, and independent duplicate-ID warnings.
