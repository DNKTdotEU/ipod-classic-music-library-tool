# Source Release Process

## Versioning policy
- Follow Semantic Versioning (`MAJOR.MINOR.PATCH`).
- `MAJOR`: breaking changes.
- `MINOR`: backward-compatible feature additions.
- `PATCH`: bug fixes and low-risk maintenance.

## Changelog policy
- Update `CHANGELOG.md` for every public release.
- Keep entries grouped by `Added`, `Changed`, `Fixed`, `Security`.
- Include migration notes and operational impact where relevant.

## Source release steps
1. Ensure CI is green (`ci` and `security-audit` checks).
2. Run local verification:
   - `npm run ci:local`
   - `npm run release:checklist`
3. Update version in `package.json`.
4. Update `CHANGELOG.md` release section.
5. Tag release: `vX.Y.Z`.
6. Publish source release notes on GitHub.

## Compatibility statement
- This milestone publishes source code only.
- Installer/distribution binaries are out of scope for this release line.
