# PRD Traceability Matrix

This matrix maps PRD user stories and acceptance criteria to implementation modules and tests.

## Epic 1: Add and scan library

- `1.1` Folder management and path validation -> `ScanService`, Scan UI tab, `ipc:scan:start`.
- `1.2` Supported file filtering -> `fileMedia.ts` extension sets, `discoverFiles()` in `ScanService`.
- `1.3` Progress/cancel -> `JobCoordinator`, `JobProgressCard`, `ipc:jobs:cancel`.

## Epic 2: Detect duplicates

- `2.1` Exact duplicate grouping -> `DuplicateDetectionService.detect()` (hash grouping), `duplicate_groups` + `duplicate_group_items` tables.
- `2.2` Likely duplicates and confidence -> `DuplicateDetectionService` (normalized title+artist, duration tolerance, confidence scoring).
- `2.3` Sensitivity control -> Scan mode (`strict|balanced|loose`) in `startScanRequestSchema`.

## Epic 3: Safe review

- `3.1` Duplicate stepping model -> `DuplicatesView` with group/candidate navigation.
- `3.2` File info display -> Format, bitrate, duration, size, metadata completeness, artwork status in `DuplicatesView`.
- `3.3` In-screen preview player -> `<audio>`/`<video>` via `media:` protocol bridge.

## Epic 4: Keep decisions

- `4.1` Manual keep/delete -> `DuplicateService.applyDecision()`, `deleteCandidateFile()`.
- `4.2` Unresolved filtering -> `DuplicatesView` "Show unresolved only" toggle.

## Epic 5: Bulk operations

- `5.1` Bulk duplicate refresh -> `runBulkDuplicateRefresh()` with `DuplicateDetectionService`.

## Epic 8: Quarantine and history

- `8.1` Move to quarantine with reason -> `QuarantineService.move()` with actual file operations (copy + unlink).
- `8.2` Restore flow -> `QuarantineService.restore()` with file restoration.
- `8.3` Permanent delete -> `QuarantineService.deletePermanently()`.
- `8.4` Full audit trail -> `HistoryRepository.record()` + `HistoryRepository.list()`, `HistoryView` UI.

## Epic 9: Dashboard

- `9.1` Health counters with deep links -> `DashboardRepository.getMetrics()`, clickable cards in `App.tsx`.
- `9.2` Resolved/unresolved counts -> Dashboard metric aggregation.

## Test mapping

### Unit tests

| Test file | Covers |
|-----------|--------|
| `tests/unit/duplicateService.test.ts` | `DuplicateService.applyDecision` |
| `tests/unit/duplicateDetection.test.ts` | Exact and likely duplicate grouping |
| `tests/unit/quarantineService.test.ts` | Move, restore, deletePermanently with real files |
| `tests/unit/repositories.test.ts` | All repository CRUD, corrupt JSON handling |
| `tests/unit/jobCoordinator.test.ts` | Run, cancel, error propagation |
| `tests/unit/preferencesStore.test.ts` | Load, save, merge, corrupt file recovery |
| `tests/unit/dashboardService.test.ts` | Metric aggregation |
| `tests/unit/progressUtils.test.ts` | Terminal progress detection (structured status) |
| `tests/unit/metadataService.test.ts` | Tag normalization |

### Integration tests

| Test file | Covers |
|-----------|--------|
| `tests/integration/migrations.test.ts` | Schema migration application |
