# V1 Release Checklist

## Build and packaging
- [ ] `npm run build` completes for renderer and electron bundles.
- [ ] Installable artifacts generated for macOS and Windows.
- [ ] Application metadata (name/version/license) verified.

## Upgrade path
- [ ] Existing DB migration from previous version applies without data loss.
- [ ] Quarantine and history records remain intact post-upgrade.
- [ ] Rule/profile settings preserved.

## Safety validation
- [ ] Delete-like actions still route to quarantine by default.
- [ ] Restore from quarantine works after upgrade.
- [ ] History log records upgrade-time and post-upgrade actions.

## Quality gates
- [ ] Unit and integration tests pass.
- [ ] E2E scenario list validated against latest UI.
- [ ] Performance baseline benchmark within threshold.

## Security and privacy
- [ ] No raw audio payloads are sent externally.
- [ ] API keys/config are not logged.
- [ ] Error messages avoid leaking sensitive local paths where unnecessary.

## Documentation
- [ ] README updated with setup, run, and safety semantics.
- [ ] Known limitations listed (v1 scope boundaries).
- [ ] User quick-start guide for scan, compare, quarantine, restore.
