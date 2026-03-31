# Data Model and Migration Plan

## Entities
- `tracks`: canonical song-level model.
- `file_copies`: concrete files tied to tracks.
- `duplicate_groups` + `duplicate_group_items`: group-level dedupe classification.
- `rules`: reusable preference profiles and conflict policies.
- `quarantine_items`: safe-delete lifecycle records.
- `history_events`: immutable audit trail.
- `schema_migrations`: migration bookkeeping.

## Migration policy
- Forward-only SQL files under `electron/db/migrations`.
- File naming convention: `NNN_description.sql`.
- Every migration is idempotent-safe and tracked in `schema_migrations`.
- Startup runs pending migrations before IPC handlers are registered.

## Backward compatibility
- Never delete columns in-place for active releases.
- Prefer additive migrations and migration-time data backfill.
- Keep history and quarantine tables append-friendly for audit continuity.
