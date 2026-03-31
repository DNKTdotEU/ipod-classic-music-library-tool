# V1 Release Checklist

## Build and packaging

- [ ] `npm run build` completes for renderer and electron bundles.
- [ ] Application metadata (name/version/license) verified in `package.json`.
- [ ] `dist-electron/` and `dist/` artifacts are clean (no stale files).

## Core functionality

- [ ] Library scan discovers files, extracts metadata, computes hashes.
- [ ] Exact duplicate detection groups files by content hash.
- [ ] Likely duplicate detection groups files by normalized title + artist.
- [ ] Duplicate review: keep, delete, reveal in folder all work.
- [ ] Quarantine move physically relocates files.
- [ ] Quarantine restore returns files to original location.
- [ ] Quarantine permanent delete removes files from disk.
- [ ] History view shows all recorded events with pagination.
- [ ] Dashboard metrics accurately reflect database state.
- [ ] Settings persist across app restarts.

## Safety validation

- [ ] Delete actions show confirmation dialog before proceeding.
- [ ] Quarantine operations use copy + unlink (cross-device safe).
- [ ] History log records all destructive actions.
- [ ] Error boundaries catch and display renderer crashes with retry.

## Quality gates

- [ ] All unit and integration tests pass (`npm test`).
- [ ] TypeScript checks pass (`npm run typecheck`).
- [ ] ESLint checks pass (`npm run lint`).
- [ ] Markdown lint passes (`npm run docs:lint`).

## Security and privacy

- [ ] No raw audio payloads are sent externally.
- [ ] API keys/config are not logged.
- [ ] Error messages avoid leaking sensitive local paths where unnecessary.
- [ ] `media:` protocol only serves files from local filesystem.

## Documentation

- [ ] README updated with current features and quick start.
- [ ] IPC contracts doc matches current channel names.
- [ ] Traceability matrix reflects actual test coverage.
- [ ] Testing strategy documented.
- [ ] CHANGELOG updated.
