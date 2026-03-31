import type { DashboardMetrics, DuplicateGroup, QuarantineItem } from "./types";

export const inMemoryStore: {
  metrics: DashboardMetrics;
  groups: DuplicateGroup[];
  quarantine: QuarantineItem[];
} = {
  metrics: {
    exactDuplicates: 0,
    likelyDuplicates: 0,
    metadataIssues: 0,
    artworkIssues: 0,
    quarantinedFiles: 0,
    resolvedGroups: 0,
    unresolvedGroups: 0
  },
  groups: [],
  quarantine: []
};
