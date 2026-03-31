export type DuplicateType = "exact" | "likely";
export type GroupStatus = "unreviewed" | "rule_resolved" | "user_resolved" | "conflict";

export type DashboardMetrics = {
  exactDuplicates: number;
  likelyDuplicates: number;
  metadataIssues: number;
  artworkIssues: number;
  quarantinedFiles: number;
  resolvedGroups: number;
  unresolvedGroups: number;
};

export type FileCopy = {
  id: string;
  path: string;
  format: string;
  bitrate: number;
  durationSec: number;
  sizeBytes: number;
  metadataCompleteness: number;
  hasArtwork: boolean;
};

export type DuplicateGroup = {
  id: string;
  type: DuplicateType;
  confidence: number;
  status: GroupStatus;
  title: string;
  artist: string;
  candidates: FileCopy[];
};

export type QuarantineItem = {
  id: string;
  originalPath: string;
  quarantinedPath: string;
  reason: string;
  createdAt: string;
};
