# Performance Gates

## Baseline dataset
- Run `npm run perf:seed` to generate deterministic 100k-row fixture data.
- Dataset path: `fixtures/perf-dataset.ndjson`.

## Benchmark command
- Run `npm run perf:run`.
- Captures read, parse, aggregate, and total timings.

## Acceptance thresholds (initial)
- 100k fixture read + parse + aggregate should complete within 3.5s on target dev machine.
- Duplicate list rendering should use windowing/virtualization when rows > 1,000.
- Long-running operations must always expose progress and cancellation controls.

## Tuning strategy
- Incremental indexing by file modified timestamp.
- Batch writes to SQLite using transactions.
- Chunked IPC messages for large payload delivery.
- Renderer list virtualization and memoized selectors.
