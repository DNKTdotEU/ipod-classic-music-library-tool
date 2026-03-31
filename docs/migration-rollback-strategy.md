# Migration Rollback Strategy

## Principles
- Migrations are forward-only and transactional.
- Rollback is performed by applying a new corrective migration, not by deleting migration history.
- Every migration must be idempotent-safe and recorded in `schema_migrations`.

## Operational rollback procedure
1. Stop new writes (maintenance mode for desktop startup).
2. Backup the SQLite database file.
3. Identify the failing migration from logs and `schema_migrations`.
4. Create a new migration to repair schema/data.
5. Validate on a copied production DB snapshot.
6. Release patched version and rerun startup migrations.

## Recovery checks
- `schema_migrations` monotonic ordering preserved.
- Critical tables (`duplicate_groups`, `quarantine_items`, `history_events`) readable.
- Quarantine restore path still functional after recovery.
