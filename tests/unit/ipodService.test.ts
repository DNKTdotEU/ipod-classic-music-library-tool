import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { listDirectory, exportTracks, deleteFromDevice, copyToDevice } from "../../electron/services/ipod/ipodService";

describe("iPod service", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ipod-svc-test-"));
  });

  describe("listDirectory", () => {
    it("lists files and directories sorted correctly", async () => {
      fs.mkdirSync(path.join(tmpDir, "subdir"));
      fs.writeFileSync(path.join(tmpDir, "b.txt"), "content");
      fs.writeFileSync(path.join(tmpDir, "a.txt"), "content");

      const entries = await listDirectory(tmpDir, "");
      expect(entries[0].name).toBe("subdir");
      expect(entries[0].type).toBe("directory");
      expect(entries[1].name).toBe("a.txt");
      expect(entries[2].name).toBe("b.txt");
    });

    it("rejects path traversal", async () => {
      await expect(listDirectory(tmpDir, "../../../etc")).rejects.toThrow("Path traversal");
    });
  });

  describe("exportTracks", () => {
    it("exports files with human-readable names", async () => {
      const sourceDir = path.join(tmpDir, "source");
      const destDir = path.join(tmpDir, "dest");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "ABCD.mp3"), "audio data");

      const result = await exportTracks(
        tmpDir,
        [{ filePath: path.join("source", "ABCD.mp3"), title: "My Song", artist: "Artist", ext: ".mp3" }],
        destDir
      );

      expect(result.exported).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      const exported = result.exported[0];
      expect(path.basename(exported)).toBe("Artist - My Song.mp3");
      expect(fs.existsSync(exported)).toBe(true);
    });

    it("reports failed exports for missing files", async () => {
      const destDir = path.join(tmpDir, "dest");
      const result = await exportTracks(
        tmpDir,
        [{ filePath: "nonexistent/file.mp3", title: "X", artist: "Y", ext: ".mp3" }],
        destDir
      );
      expect(result.exported).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
    });

    it("calls progress callback", async () => {
      const sourceDir = path.join(tmpDir, "source");
      const destDir = path.join(tmpDir, "dest");
      fs.mkdirSync(sourceDir, { recursive: true });
      fs.writeFileSync(path.join(sourceDir, "a.mp3"), "data");

      const calls: [number, number][] = [];
      await exportTracks(
        tmpDir,
        [{ filePath: path.join("source", "a.mp3"), title: "S", artist: "A", ext: ".mp3" }],
        destDir,
        (done, total) => calls.push([done, total])
      );
      expect(calls).toEqual([[1, 1]]);
    });
  });

  describe("copyToDevice", () => {
    it("copies files to device directory", async () => {
      const srcFile = path.join(tmpDir, "source.txt");
      fs.writeFileSync(srcFile, "hello");
      const destRel = "storage";

      const result = await copyToDevice(tmpDir, destRel, [srcFile]);
      expect(result.copied).toHaveLength(1);
      expect(fs.existsSync(path.join(tmpDir, destRel, "source.txt"))).toBe(true);
    });
  });

  describe("deleteFromDevice", () => {
    it("deletes files from device", async () => {
      const file = path.join(tmpDir, "delete-me.txt");
      fs.writeFileSync(file, "bye");

      const result = await deleteFromDevice(tmpDir, ["delete-me.txt"]);
      expect(result.deleted).toEqual(["delete-me.txt"]);
      expect(fs.existsSync(file)).toBe(false);
    });

    it("reports failures for nonexistent files", async () => {
      const result = await deleteFromDevice(tmpDir, ["nope.txt"]);
      expect(result.failed).toEqual(["nope.txt"]);
    });

    it("rejects path traversal", async () => {
      await expect(deleteFromDevice(tmpDir, ["../../etc/passwd"])).rejects.toThrow("Path traversal");
    });
  });
});
