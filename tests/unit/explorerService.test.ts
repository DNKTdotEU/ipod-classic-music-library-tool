import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExplorerService } from "../../electron/services/explorerService";

describe("ExplorerService", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) fs.rmSync(dir, { recursive: true, force: true });
    tempDirs.length = 0;
  });

  function makeTemp(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "explorer-service-"));
    tempDirs.push(dir);
    return dir;
  }

  function createService() {
    const trackRepository = { removeFileCopyByPath: vi.fn() };
    const quarantineService = { move: vi.fn() };
    const historyRepository = { record: vi.fn() };
    return {
      service: new ExplorerService(
        trackRepository as never,
        quarantineService as never,
        historyRepository as never
      ),
      trackRepository,
      quarantineService,
      historyRepository
    };
  }

  it("blocks path traversal outside root", () => {
    const { service } = createService();
    const root = makeTemp();
    expect(() => service.resolveWithinRoot(root, "../escape.mp3")).toThrow("Path escapes selected root");
  });

  it("deletes selected files and updates track index", async () => {
    const { service, trackRepository } = createService();
    const root = makeTemp();
    const target = path.join(root, "song.mp3");
    fs.writeFileSync(target, "audio");

    const result = await service.delete(root, ["song.mp3"]);
    expect(result.deleted).toEqual(["song.mp3"]);
    expect(result.failed).toEqual([]);
    expect(fs.existsSync(target)).toBe(false);
    expect(trackRepository.removeFileCopyByPath).toHaveBeenCalledWith(target);
  });

  it("quarantines selected files through quarantine service", () => {
    const { service, quarantineService } = createService();
    const root = makeTemp();
    const target = path.join(root, "song.mp3");
    fs.writeFileSync(target, "audio");

    const result = service.quarantine(root, ["song.mp3"]);
    expect(result.moved).toEqual(["song.mp3"]);
    expect(result.failed).toEqual([]);
    expect(quarantineService.move).toHaveBeenCalledWith(target, "Explorer cleanup action");
  });

  it("finds non-audio files via smart filter", async () => {
    const { service } = createService();
    const root = makeTemp();
    fs.writeFileSync(path.join(root, "keep.mp3"), "audio");
    fs.writeFileSync(path.join(root, "cleanup.txt"), "text");

    const out = await service.applySmartFilter(root, "", "non_audio");
    expect(out).toContain("cleanup.txt");
    expect(out).not.toContain("keep.mp3");
  });
});

