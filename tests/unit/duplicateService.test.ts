import { describe, expect, it } from "vitest";
import { DuplicateService } from "../../electron/services/duplicateService";
import { inMemoryStore } from "../../electron/services/inMemoryStore";

describe("DuplicateService", () => {
  it("returns false for unknown decision target", () => {
    const service = new DuplicateService();
    expect(service.applyDecision("none", "none")).toBe(false);
  });

  it("marks group resolved when keep candidate exists", () => {
    inMemoryStore.groups = [
      {
        id: "g1",
        type: "likely",
        confidence: 0.9,
        status: "unreviewed",
        title: "t",
        artist: "a",
        candidates: [
          {
            id: "f1",
            path: "/x",
            format: "mp3",
            bitrate: 1,
            durationSec: 1,
            sizeBytes: 1,
            metadataCompleteness: 1,
            hasArtwork: false
          }
        ]
      }
    ];
    inMemoryStore.metrics.resolvedGroups = 0;
    inMemoryStore.metrics.unresolvedGroups = 1;
    const service = new DuplicateService();
    expect(service.applyDecision("g1", "f1")).toBe(true);
    expect(inMemoryStore.groups[0].status).toBe("user_resolved");
  });
});
