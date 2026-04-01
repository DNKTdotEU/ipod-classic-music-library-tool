import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverFiles } from "../../electron/services/scanService";

describe("discoverFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test-"));

    fs.writeFileSync(path.join(tmpDir, "song.mp3"), "fake-audio");
    fs.writeFileSync(path.join(tmpDir, "track.flac"), "fake-audio");
    fs.writeFileSync(path.join(tmpDir, "video.mp4"), "fake-video");
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), "text file");
    fs.writeFileSync(path.join(tmpDir, "cover.jpg"), "image");
    fs.writeFileSync(path.join(tmpDir, "data.json"), "{}");

    const subDir = path.join(tmpDir, "sub");
    fs.mkdirSync(subDir);
    fs.writeFileSync(path.join(subDir, "nested.wav"), "fake-audio");
    fs.writeFileSync(path.join(subDir, "notes.md"), "markdown");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns only media files", async () => {
    const noop = vi.fn();
    const files = await discoverFiles([tmpDir], noop, () => false);
    const basenames = files.map((f) => path.basename(f)).sort();
    expect(basenames).toEqual(["nested.wav", "song.mp3", "track.flac", "video.mp4"]);
  });

  it("excludes non-media files", async () => {
    const files = await discoverFiles([tmpDir], vi.fn(), () => false);
    const basenames = files.map((f) => path.basename(f));
    expect(basenames).not.toContain("readme.txt");
    expect(basenames).not.toContain("cover.jpg");
    expect(basenames).not.toContain("data.json");
    expect(basenames).not.toContain("notes.md");
  });

  it("scans nested directories", async () => {
    const files = await discoverFiles([tmpDir], vi.fn(), () => false);
    const basenames = files.map((f) => path.basename(f));
    expect(basenames).toContain("nested.wav");
  });

  it("reports progress during scan", async () => {
    const progressFn = vi.fn();
    await discoverFiles([tmpDir], progressFn, () => false);
    expect(progressFn).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "scan" })
    );
  });

  it("stops early when cancelled", async () => {
    let callCount = 0;
    const files = await discoverFiles(
      [tmpDir],
      vi.fn(),
      () => {
        callCount++;
        return callCount > 1;
      }
    );
    expect(files.length).toBeLessThanOrEqual(4);
  });

  it("returns empty array for nonexistent folder", async () => {
    const files = await discoverFiles(["/nonexistent-folder-xyz"], vi.fn(), () => false);
    expect(files).toEqual([]);
  });

  it("handles multiple folders", async () => {
    const subDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "scan-test2-"));
    fs.writeFileSync(path.join(subDir2, "extra.ogg"), "fake-audio");

    try {
      const files = await discoverFiles([tmpDir, subDir2], vi.fn(), () => false);
      const basenames = files.map((f) => path.basename(f));
      expect(basenames).toContain("extra.ogg");
      expect(basenames).toContain("song.mp3");
    } finally {
      fs.rmSync(subDir2, { recursive: true, force: true });
    }
  });

  it("deduplicates same physical file across hard links", async () => {
    const first = path.join(tmpDir, "same.mp3");
    const second = path.join(tmpDir, "same-hardlink.mp3");
    fs.writeFileSync(first, "same-audio");
    fs.linkSync(first, second);

    const files = await discoverFiles([tmpDir], vi.fn(), () => false);
    const sameFiles = files.filter((f) => path.basename(f).startsWith("same"));
    expect(sameFiles.length).toBe(1);
  });
});
