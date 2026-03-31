# Testing Strategy

## Overview

The project uses **Vitest** for all automated tests, running in a Node.js environment. Tests are organized by scope: unit tests for isolated logic and integration tests for cross-module behavior.

## Test structure

```
tests/
├── unit/                         — isolated tests per module
│   ├── duplicateService.test.ts
│   ├── duplicateDetection.test.ts
│   ├── quarantineService.test.ts
│   ├── repositories.test.ts
│   ├── jobCoordinator.test.ts
│   ├── preferencesStore.test.ts
│   ├── dashboardService.test.ts
│   ├── progressUtils.test.ts
│   ├── ipodService.test.ts
│   ├── itunesDbParser.test.ts
│   ├── sysInfoParser.test.ts
│   ├── modelDatabase.test.ts
│   ├── scanService.test.ts
│   └── errors.test.ts
├── integration/                  — cross-module tests
│   └── migrations.test.ts
└── e2e/                          — scenario specs (manual for now)
    └── workflows.spec.md
```

## Running tests

```bash
npm test              # full run with native addon rebuild
npm run test:watch    # watch mode for development
npx vitest --coverage # run with v8 coverage report
```

## Coverage

Coverage is configured with the `v8` provider in `vitest.config.ts`. Reports are generated in `text` (terminal) and `lcov` (CI integration) formats.

Scope includes all `electron/**/*.ts` and `src/**/*.ts` files, excluding test files, type declarations, and ambient type files.

## Test patterns

### Database tests

Tests that need SQLite create a temporary database per test case using `fs.mkdtempSync`. Each test gets a fresh database with migrations applied. No shared state between tests.

### File system tests

Tests that interact with the filesystem (quarantine, preferences) use temporary directories. Files are created and verified within the test scope.

### Async tests

The `JobCoordinator` tests use `vi.waitFor()` to assert on async events without arbitrary timeouts.

### iPod / device tests

iPod service and parser tests use in-memory `Buffer` objects with synthetic binary data to exercise the iTunesDB and SysInfo parsers. File operation tests (`ipodService`, `scanService`) use `fs.mkdtempSync` temporary directories.

## What is not tested

- **Electron IPC layer**: Requires a running Electron process. The handler logic is tested through service-level unit tests.
- **React components**: No component tests yet. UI behavior is verified through the service layer and manual testing.
- **E2E workflows**: Described in `tests/e2e/workflows.spec.md` as manual scenarios.

## Adding new tests

1. Create the test file in the appropriate `tests/unit/` or `tests/integration/` directory.
2. Follow the naming convention: `<module>.test.ts`.
3. Use `beforeEach` for per-test setup (fresh DB, temp dirs).
4. Import from source using relative paths (e.g., `../../electron/services/...`).
