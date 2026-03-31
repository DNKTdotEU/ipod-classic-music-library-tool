import { randomUUID } from "node:crypto";
import type { ProgressEvent } from "../ipc/contracts";
import type { DuplicateGroup } from "./types";
import { DuplicateRepository, HistoryRepository } from "../db/repositories";

export class ScanService {
  constructor(
    private readonly duplicateRepository: DuplicateRepository,
    private readonly historyRepository: HistoryRepository
  ) {}

  async runScan(jobId: string, onProgress: (event: Omit<ProgressEvent, "jobId">) => void): Promise<void> {
    const phases: ProgressEvent["phase"][] = ["scan", "analyze", "group", "finalize"];

    phases.forEach((phase, idx) => {
      onProgress({
        phase,
        processed: idx + 1,
        total: phases.length,
        message: `Phase ${phase} finished`
      });
    });

    const demoGroup: DuplicateGroup = {
      id: randomUUID(),
      type: "likely",
      confidence: 0.91,
      status: "unreviewed",
      title: "Demo Track",
      artist: "Demo Artist",
      candidates: [
        {
          id: randomUUID(),
          path: "/music/demo-track-v1.mp3",
          format: "mp3",
          bitrate: 192000,
          durationSec: 210,
          sizeBytes: 5092923,
          metadataCompleteness: 0.92,
          hasArtwork: true
        },
        {
          id: randomUUID(),
          path: "/music/demo-track-v2.flac",
          format: "flac",
          bitrate: 810000,
          durationSec: 211,
          sizeBytes: 21892012,
          metadataCompleteness: 0.76,
          hasArtwork: false
        }
      ]
    };

    this.duplicateRepository.replaceDemoGroups([demoGroup]);
    this.historyRepository.record("scan_completed", "Scan completed successfully", { jobId });
  }
}
