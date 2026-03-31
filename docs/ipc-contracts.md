# IPC Contract and Event Model

## Request-response channels
- `scan:start`
  - Request: `{ folders: string[]; mode: "strict" | "balanced" | "loose" }`
  - Response: `Envelope<{ jobId: string }>`
- `dashboard:get`
  - Response: `Envelope<DashboardMetrics>`
- `duplicates:get`
  - Response: `Envelope<DuplicateGroup[]>`
- `duplicates:decision`
  - Request: `{ groupId: string; keepFileId: string }`
  - Response: `Envelope<{ applied: boolean }>`
- `quarantine:get`
  - Response: `Envelope<QuarantineItem[]>`
- `quarantine:restore`
  - Request: `itemId: string`
  - Response: `Envelope<{ restored: boolean }>`

## Progress event channel
- `jobs:progress`
  - Event payload: `{ jobId, phase, processed, total, message }`
  - Phase enum: `scan | analyze | group | finalize`

## Error envelope
- Standard error object:
  - `code: string`
  - `message: string`
  - `details?: string`
- Contract:
  - success: `{ ok: true, data: T }`
  - failure: `{ ok: false, error: AppError }`
