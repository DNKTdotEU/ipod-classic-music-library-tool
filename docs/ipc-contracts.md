# IPC Contract and Event Model

## Request-response channels

| Channel | Request | Response |
|---------|---------|----------|
| `scan:start` | `{ folders: string[]; mode: "strict" \| "balanced" \| "loose" }` | `Envelope<{ jobId: string }>` |
| `duplicates:refreshJob` | (none) | `Envelope<{ jobId: string }>` |
| `jobs:cancel` | `jobId: string` | `Envelope<{ cancelled: boolean }>` |
| `dialog:pickPaths` | `{ mode: "directory" \| "file"; multiple: boolean; title?: string }` | `Envelope<{ paths: string[]; dismissed: boolean }>` |
| `dialog:confirm` | `{ message: string; detail?: string; confirmButton?: string; checkboxLabel?: string }` | `Envelope<{ confirmed: boolean; checkboxChecked: boolean }>` |
| `dashboard:get` | (none) | `Envelope<DashboardMetrics>` |
| `duplicates:get` | (none) | `Envelope<DuplicateGroup[]>` |
| `duplicates:decision` | `{ groupId: string; keepFileId: string }` | `Envelope<{ applied: boolean; deleted: string[]; failed: string[] }>` |
| `duplicates:deleteCandidate` | `{ groupId: string; fileId: string }` | `Envelope<{ deleted: boolean }>` |
| `shell:showItemInFolder` | `filePath: string` | `Envelope<{ shown: boolean }>` |
| `quarantine:get` | (none) | `Envelope<QuarantineItem[]>` |
| `quarantine:restore` | `itemId: string` | `Envelope<{ restored: boolean }>` |
| `quarantine:deletePermanently` | `itemId: string` | `Envelope<{ deleted: boolean }>` |
| `history:get` | `{ limit?: number; offset?: number }` | `Envelope<{ items: HistoryEvent[]; total: number }>` |
| `settings:get` | (none) | `Envelope<UserSettings>` |
| `settings:set` | `UserSettingsPatch` | `Envelope<UserSettings>` |
| `app:paths` | (none) | `Envelope<AppPathsInfo>` |
| `explorer:list` | `{ rootPath: string; relativePath?: string }` | `Envelope<FsEntry[]>` |
| `explorer:delete` | `{ rootPath: string; relativePaths: string[] }` | `Envelope<{ deleted: string[]; failed: string[] }>` |
| `explorer:getMetadata` | `{ rootPath: string; relativePath: string }` | `Envelope<ExplorerMetadata>` |
| `explorer:quarantine` | `{ rootPath: string; relativePaths: string[] }` | `Envelope<{ moved: string[]; failed: string[] }>` |
| `explorer:ignore` | `{ rootPath: string; relativePaths: string[]; mode: "add" \| "remove" \| "replace" }` | `Envelope<{ ignoredExplorerPaths: string[] }>` |
| `explorer:bulkRename` | `{ rootPath: string; items: { fromRelativePath: string; toFilename: string }[]; dryRun?: boolean }` | `Envelope<{ renamed: { from: string; to: string }[]; failed: string[] }>` |
| `explorer:smartFilter` | `{ rootPath: string; relativePath?: string; preset: "missing_tags" \| "low_bitrate" \| "short_duration" \| "duplicate_like_name" \| "non_audio"; lowBitrateKbps?: number; shortDurationSec?: number }` | `Envelope<{ relativePaths: string[] }>` |
| `devices:detect` | (none) | `Envelope<IpodDevice[]>` |
| `devices:library` | `mountPath: string` | `Envelope<IpodLibrary>` |
| `devices:browse` | `{ mountPath: string; relativePath: string }` | `Envelope<FsEntry[]>` |
| `devices:exportTracks` | `{ mountPath: string; tracks: ExportTrackItem[]; destDir: string }` | `Envelope<{ exported: string[]; failed: string[] }>` |
| `devices:copyToDevice` | `{ mountPath: string; destRelative: string; sourcePaths: string[] }` | `Envelope<{ copied: string[]; failed: string[] }>` |
| `devices:deleteFromDevice` | `{ mountPath: string; relativePaths: string[] }` | `Envelope<{ deleted: string[]; failed: string[] }>` |

## Progress event channel

- Channel: `jobs:progress`
- Event payload:

```typescript
{
  jobId: string;
  jobType: "scan" | "bulk_duplicate" | "metadata_batch" | "artwork_batch";
  phase: "scan" | "analyze" | "group" | "finalize" | "prepare" | "process" | "commit";
  processed: number;
  total: number;
  message: string;
  status: "running" | "completed" | "cancelled" | "error";
}
```

Terminal detection: check `status === "completed" || status === "cancelled" || status === "error"`.

## Error envelope

Standard error object:

- `code: string`
- `message: string`
- `details?: string`

Contract:

- Success: `{ ok: true, data: T }`
- Failure: `{ ok: false, error: AppError }`
