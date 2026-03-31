# PRD Traceability Matrix

This matrix maps PRD user stories and acceptance criteria to implementation modules and tests.

## Epic 1: Add and scan library
- `1.1` Folder management and path validation -> `ScanService`, `scan.setup` UI, `ipc.scan.start`.
- `1.2` Supported file filtering and skip reporting -> `ScanService`, `ingest.supportedExtensions`, scan report panel.
- `1.3` Progress/cancel and incomplete labeling -> `JobCoordinator`, `ScanProgress` UI, `ipc.jobs.cancel`.

## Epic 2: Detect duplicates
- `2.1` Exact duplicate grouping -> `DuplicateService.computeExactGroups()`, `duplicate_groups` table.
- `2.2` Likely duplicates and confidence -> `AnalysisService`, `DuplicateService.computeLikelyGroups()`.
- `2.3` Sensitivity control -> `Rule/Profile` settings, scan setup control (`strict|balanced|loose`).

## Epic 3: Safe review
- `3.1` Side-by-side compare model -> `CompareView` and `compare DTO`.
- `3.2` Difference highlighting and mismatch flags -> renderer compare diff helpers.
- `3.3` In-screen preview player -> `PreviewPlayer` component and media URL bridge.

## Epic 4: Keep decisions
- `4.1` Manual keep/select/defer -> `DuplicateDecisionService`.
- `4.2` Keep-first by sort order -> deterministic sorting strategy in duplicate list.
- `4.3` Smart keep actions -> `RulesService.evaluateGroup()`.
- `4.4` Ask-on-conflict queue -> conflict queue status in `duplicate_groups`.

## Epic 5: Bulk rules
- `5.1` Rule creation and reuse -> `rules` table + rules UI.
- `5.2` Bulk preview and confirmation -> `BulkPreview` API + confirmation modal.

## Epic 6: Metadata
- `6.1` Single/batch edit -> `MetadataService.updateTags()`.
- `6.2` Missing/suspicious metadata filtering -> dashboard chips + issue filters.
- `6.3` Normalization helpers -> `MetadataService.normalize()`.

## Epic 7: Artwork
- `7.1` Search by release fields -> `ArtworkService.search()`.
- `7.2` Quality preview and cover-type indication -> artwork results model.
- `7.3` Missing-artwork step-through workflow -> artwork queue and apply/skip/defer actions.

## Epic 8: Quarantine and history
- `8.1` Move to quarantine with reason -> `QuarantineService.move()`, `quarantine_items`.
- `8.2` Restore flow -> `QuarantineService.restore()`.
- `8.3` Full audit trail -> `HistoryService.record()`, `history_events`.

## Epic 9: Dashboard
- `9.1` Health counters with deep links -> `DashboardService.getMetrics()`.
- `9.2` Progress counters -> resolved/unresolved metric aggregation.

## Test mapping
- Unit: duplicate scoring, rules evaluation, metadata normalization.
- Integration: IPC contracts, migrations, quarantine/restore transactions.
- E2E: scan -> review -> quarantine -> restore, metadata batch edits, artwork apply flow.
