# ipod-classic-music-library-tool

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)

Desktop-first application for cleaning duplicate music files, comparing variants, improving metadata/artwork quality, and safely preparing local libraries for iPod-friendly workflows.

## Project status

- Milestone: **production-ready source release**.
- Distribution target in this milestone: **source only**.
- Public installers are planned for a future milestone.

## Features

- **Library scanning** with real filesystem discovery, metadata extraction via `music-metadata`, and SHA-256 file hashing. Progress events stream to the UI with cancel support.
- **Duplicate detection** — exact duplicates (by file content hash) and likely duplicates (by normalized title + artist). Confidence threshold and duration tolerance are configurable in Settings.
- **Duplicate review** — step through groups and candidates, preview audio/video in-app, keep/delete/skip/reveal decisions with filter for unresolved groups.
- **Quarantine safety model** — files are physically moved to a quarantine directory (copy + unlink for cross-device safety). Restore or permanently delete from quarantine with full audit history.
- **Dashboard** with human-readable metric cards linking to relevant views.
- **History timeline** with paginated event log, expandable payloads, and event type badges.
- **Explorer (song cleanup workspace)** — split-screen file browser with in-app audio/video preview, metadata inspector, smart cleanup filters (missing tags, low bitrate, short duration, duplicate-like names, non-audio), batch rename preview/apply, quarantine move, ignore-in-scan list, and safe delete actions.
- **Settings** for scan mode, reconcile strategy (full vs incremental), likely-duplicate thresholds, folder defaults, log level, confirmation dialog preferences, and application path inspection.
- **Devices (Experimental)** — detect connected iPod devices (Classic, Video, Nano, Mini, Shuffle), parse iTunesDB to browse the on-device music library, export tracks with human-readable filenames, and use the iPod as external file storage with a built-in file explorer.
- **SQLite persistence** with migration framework, startup health checks, and WAL mode.
- **Typed IPC** with Zod validation, envelope error pattern, and structured progress events with status field.

## Architecture

```
Electron main process
├── core/        — config, logger, health checks, job coordinator, error helpers
├── db/          — SQLite client, migrations, repositories (Track, Duplicate, Quarantine, Dashboard, History)
├── ipc/         — channel constants, Zod contracts, handler registration
├── media/       — file extension helpers
└── services/
    ├── scan, duplicate detection, duplicate decisions, quarantine, dashboard, preferences
    └── ipod/    — device detection, iTunesDB parser, SysInfo parser, model database

React renderer (Vite)
├── ui/          — App, DuplicatesView, DevicesView, HistoryView, SettingsView, JobProgressCard, ErrorBoundary
├── ipc/         — renderer-safe types (incl. iPod types), progress utilities
└── media/       — client-side file type helpers
```

See product planning and architecture docs under `docs/`.

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

   This runs a **postinstall** step that rebuilds `better-sqlite3` for Electron's Node.js ABI.

2. Start the app in development:

   ```bash
   npm run dev
   ```

   Vite serves the renderer on port **5173**, Electron main/preload compile to `dist-electron/`, and the window loads the dev server.

3. Scan a music library: go to **Scan**, add one or more folders, choose a mode, and click **Start scan**. The scan indexes files, extracts metadata, hashes content, and detects duplicates.
   - **Full reconcile** mode prunes stale database entries for files missing on disk.
   - **Incremental** mode keeps records outside the scanned folders.

4. Review duplicates: switch to **Duplicates**, step through groups, preview audio, and use **Keep This**, **Delete file**, or **Skip** to resolve.

5. Run quality gates:

   ```bash
   npm run ci:local
   ```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start app in development (Vite + Electron) |
| `npm run build` | Build renderer and electron for production |
| `npm run lint` | ESLint checks |
| `npm run typecheck` | TypeScript checks (renderer + electron + preload) |
| `npm test` | Run Vitest suite (rebuilds native addon for Node, restores for Electron after) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run docs:lint` | Markdown linting |
| `npm run validate` | lint + typecheck + test |
| `npm run ci:local` | validate + docs:lint |

## Testing

- **103 tests** across 15 test files (unit + integration).
- Coverage configured with `v8` provider (run `npx vitest --coverage`).
- See `docs/testing-strategy.md` for the testing approach.

## Dependencies

All dependencies are free, open-source software. See [`docs/third-party-attribution.md`](./docs/third-party-attribution.md) for the complete list with links.

| Package | Role | License |
|---------|------|---------|
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) | SQLite persistence | MIT |
| [electron](https://github.com/electron/electron) | Desktop framework | MIT |
| [music-metadata](https://github.com/borewit/music-metadata) | Audio metadata extraction | MIT |
| [react](https://github.com/facebook/react) / react-dom | UI rendering | MIT |
| [zod](https://github.com/colinhacks/zod) | IPC schema validation | MIT |
| [typescript](https://github.com/microsoft/TypeScript) | Type system (dev) | Apache-2.0 |
| [vite](https://github.com/vitejs/vite) | Build tooling (dev) | MIT |
| [vitest](https://github.com/vitest-dev/vitest) | Test runner (dev) | MIT |

## Public repository basics

- Contributing guide: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Code of conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Security policy: [`SECURITY.md`](./SECURITY.md)
- License: [`LICENSE`](./LICENSE)
- Notices: [`NOTICE`](./NOTICE)

## Troubleshooting

### `better-sqlite3` / NODE_MODULE_VERSION mismatch in Electron

Native addons must match **Electron's** embedded Node, not your shell Node. After `npm install`, `postinstall` runs `electron-rebuild` for `better-sqlite3`. If you still see an ABI error, run `npm run rebuild:electron`. If tests were run locally, run `npm run rebuild:electron` again before starting the app (tests temporarily rebuild the module for Vitest).

### Duplicates reappear after rescanning

Set **Scan reconcile mode** to **Full reconcile** in Settings and run a new scan. Full reconcile removes stale database records for files that no longer exist on disk before duplicate groups are rebuilt.

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
- `docs/testing-strategy.md`
- `docs/ipod-format.md`
- `docs/third-party-attribution.md`
