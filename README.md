# ipod-classic-music-library-tool

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](../../actions/workflows/ci.yml)

Desktop-first application for cleaning duplicate music files, comparing variants, improving metadata/artwork quality, and safely preparing local libraries for iPod-friendly workflows.

## Project status
- Milestone: **production-ready source release**.
- Distribution target in this milestone: **source only**.
- Public installers are planned for a future milestone.

## Features (current baseline)
- Library scan orchestration with progress events and typed IPC contracts.
- Duplicate review model (exact/likely groups, confidence, decision flow).
- Quarantine-first safety model and audit history primitives.
- Metadata normalization and artwork search service scaffolding.
- SQLite schema + migration framework with startup health checks.

## Architecture
- Electron main process for privileged operations and IPC.
- React renderer for UI workflows.
- Domain services for scan, dedupe, metadata, artwork, quarantine, history.
- SQLite persistence and migration tracking.

See product planning and architecture docs under `docs/`.

## Development setup
1. Install dependencies:
   - `npm install`
2. Start app in development:
   - `npm run dev`
3. Run quality gates:
   - `npm run ci:local`

## Scripts
- `npm run lint` - ESLint checks
- `npm run typecheck` - TypeScript checks (renderer + electron)
- `npm test` - unit/integration tests
- `npm run docs:lint` - markdown linting
- `npm run perf:seed` and `npm run perf:run` - synthetic performance baseline
- `npm run release:checklist` - release checklist summary

## Public repository basics
- Contributing guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Security policy: [`SECURITY.md`](./SECURITY.md)
- License: [`LICENSE`](./LICENSE)
- Notices: [`NOTICE`](./NOTICE)

## Security and privacy notes
- Do not commit secrets or personal library data.
- Use synthetic fixtures for tests and examples.
- For vulnerabilities, follow private reporting instructions in `SECURITY.md`.

## Docs index
- `docs/traceability-matrix.md`
- `docs/ux-spec.md`
- `docs/ipc-contracts.md`
- `docs/data-model-migration-plan.md`
- `docs/migration-rollback-strategy.md`
- `docs/phase-gates.md`
- `docs/performance-gates.md`
- `docs/release-checklist.md`