# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- **Experimental Devices tab**: New "Devices" tab for detecting, browsing, and managing iPod devices connected via USB mass storage. Includes a custom iTunesDB binary parser (read-only), SysInfo-based model identification, file explorer, track export with human-readable names, and storage analysis. Supports iPod Classic, Video, Nano, Mini, and Shuffle. Marked as experimental with a suppressible notice dialog.
- **Keep This deletes others**: "Keep This" now physically deletes all other candidates in a duplicate group from disk, marks the group resolved, and reports deleted/failed paths.
- **Suppressible confirmation dialogs**: Both "Keep This" and "Delete file" show a native confirmation with a "Do not ask again" checkbox. The suppression flag is persisted in user preferences.
- **Confirmation dialog toggles in Settings**: New checkboxes in the Settings view to re-enable suppressed confirmation dialogs.
- **Real filesystem scan pipeline**: Recursive directory walker, metadata extraction via `music-metadata`, SHA-256 file hashing, batch processing with progress events. Populates `tracks` and `file_copies` tables.
- **Duplicate detection engine**: Exact duplicates by content hash, likely duplicates by normalized title+artist with duration tolerance. Confidence scoring. Populates `duplicate_groups` and `duplicate_group_items` tables.
- **Quarantine file operations**: `move()` now physically copies files to quarantine directory and removes originals. `restore()` copies back and removes quarantined copy. `deletePermanently()` removes quarantined files from disk.
- **History view**: Paginated timeline of all recorded events with expandable payloads and event type badges.
- **Dashboard improvements**: Human-readable metric labels, clickable cards that navigate to relevant views.
- **Duplicate view improvements**: "Show unresolved only" filter toggle, file info display (format, bitrate, duration, size, metadata quality, artwork status).
- **Quarantine view improvements**: Permanent delete button with confirmation dialog, improved formatting.
- **Status message system**: Success/error/info differentiation with auto-clear for non-error messages.
- **Structured progress events**: Added `status` field (`running`/`completed`/`cancelled`/`error`) to progress events, replacing fragile string-based terminal detection.
- **Accessibility**: `aria-current` on navigation, `aria-live` status messages, `aria-label` on progress bars, `prefers-reduced-motion` media query, `role="alert"` on error boundary.
- **ErrorBoundary recovery**: "Try again" button to reset error state without reload.
- **Comprehensive test suite**: 99 tests across 14 files covering repositories, services, job coordinator, preferences, duplicate detection, quarantine operations, progress utilities, iPod parsers, model database, scan discovery, and error helpers.
- **Coverage configuration**: v8 coverage provider configured in Vitest.
- **Testing strategy documentation**: `docs/testing-strategy.md`.
- Production-readiness docs and governance files for public repository usage.
- CI workflows for quality checks and dependency security audit.
- Source release process documentation and release checklist automation.

### Changed

- **`applyDecision` is now async**: Returns `{ ok, deleted, failed }` instead of a boolean, enabling the renderer to report per-file outcomes.
- **`dialog:confirm` extended**: Supports optional `checkboxLabel` in request and returns `checkboxChecked` in response.
- **DuplicatesView intro text**: Updated to explain the new "Keep This" destructive behavior.
- **Startup error handling**: Database, migration, and health check failures now show an error dialog and quit gracefully instead of crashing silently.
- **JobCoordinator**: Task rejections are caught and emit structured error progress events instead of becoming unhandled promise rejections.
- **Repository safety**: `JSON.parse` calls in `DuplicateRepository` wrapped in try/catch with graceful fallback for corrupt data.
- **IPC validation**: `APPLY_DECISION` handler now validates input with Zod schema. All query handlers wrapped in try/catch with `mapError`.
- **Progress bar**: Guards against `total === 0` (NaN prevention), `aria-valuemin` corrected to 0.
- **ScanService**: Rewritten from demo/fake scan to real filesystem scanning with `music-metadata` and `crypto` hashing.
- **BulkDuplicateRefreshJob**: Now uses `DuplicateDetectionService` for real re-detection instead of simulated delays.
- **DevicesView refactored**: iPod types (`IpodDevice`, `IpodTrack`, `IpodLibrary`, `FsEntry`) extracted to shared `src/ipc/types.ts` to eliminate duplication. `exportAll` no longer uses `setTimeout` hack. `copyFilesToDevice` now surfaces the count of failed files.
- **itunesDbParser**: Removed unused `headerSize` parameter from `parseMhodString`.
- **duplicateService**: `applyDecision` catch now captures and reports the error reason in failed entries.
- **SettingsView**: `getAppPaths` failure now displays a status message.
- **discoverFiles**: Exported for direct unit testing.
- Runtime architecture hardened with repository-backed service wiring and structured error/logging primitives.
- Startup safety improved with database pragmas and health checks.

- **Third-party attribution**: Full dependency table in `docs/third-party-attribution.md` listing every package, its license (all MIT/Apache-2.0), and a repository link. `NOTICE` file updated with explicit package list. Dependencies section added to README.

### Removed

- `inMemoryStore.ts` — dead code that was exported but never imported anywhere.
- `historyService.ts`, `artworkService.ts`, `metadataService.ts`, `rulesService.ts` — orphan stub services never imported by any module.
- Demo/fake scan data generation in `ScanService`.
- String-based terminal progress detection (`isTerminalProgress` now uses structured `status` field).

### Fixed

- Duplicate finalize progress event was emitted twice at `processed: 4` — corrected to use `steps.length + 1`.
- `QuarantineService.move()` now actually moves files instead of only recording metadata.
- `QuarantineService.restore()` now actually restores files to original location.
