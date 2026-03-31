import { describe, expect, it } from "vitest";
import { parseItunesDb } from "../../electron/services/ipod/itunesDbParser";

/**
 * Build a minimal synthetic iTunesDB buffer for testing.
 * Structure: mhbd -> mhsd (type 1) -> mhlt (1 track) -> mhit -> mhod (title) + mhod (artist) + mhod (location)
 */
function buildMinimalDb(options?: {
  title?: string;
  artist?: string;
  location?: string;
  bitrate?: number;
  durationMs?: number;
}): Buffer {
  const title = options?.title ?? "Test Song";
  const artist = options?.artist ?? "Test Artist";
  const location = options?.location ?? ":iPod_Control:Music:F00:ABCD.mp3";
  const bitrate = options?.bitrate ?? 256;
  const durationMs = options?.durationMs ?? 180000;

  const mhods: Buffer[] = [];

  function buildMhod(type: number, str: string): Buffer {
    const strBuf = Buffer.from(str, "utf16le");
    const headerSize = 24;
    const stringHeaderSize = 16;
    const totalSize = headerSize + stringHeaderSize + strBuf.length;
    const buf = Buffer.alloc(totalSize);
    buf.write("mhod", 0, 4, "ascii");
    buf.writeUInt32LE(headerSize, 4);
    buf.writeUInt32LE(totalSize, 8);
    buf.writeUInt32LE(type, 12);
    // String sub-header at offset 24
    buf.writeUInt32LE(1, 24);     // position
    buf.writeUInt32LE(strBuf.length, 28);  // string length
    buf.writeUInt32LE(0, 32);     // unknown
    buf.writeUInt32LE(2, 36);     // encoding (2 = UTF-16LE)
    strBuf.copy(buf, 40);
    return buf;
  }

  mhods.push(buildMhod(1, title));
  mhods.push(buildMhod(4, artist));
  mhods.push(buildMhod(2, location));

  const mhodsTotalSize = mhods.reduce((s, b) => s + b.length, 0);

  // mhit header (0x9c = 156 bytes minimum)
  const mhitHeaderSize = 156;
  const mhitTotalSize = mhitHeaderSize + mhodsTotalSize;
  const mhitBuf = Buffer.alloc(mhitHeaderSize);
  mhitBuf.write("mhit", 0, 4, "ascii");
  mhitBuf.writeUInt32LE(mhitHeaderSize, 4);
  mhitBuf.writeUInt32LE(mhitTotalSize, 8);
  mhitBuf.writeUInt32LE(mhods.length, 12);
  mhitBuf.writeUInt32LE(42, 16);            // id
  mhitBuf.writeUInt32LE(0x01, 28);          // media type (audio)
  mhitBuf.writeUInt32LE(0, 32);             // rating
  mhitBuf.writeUInt32LE(4000000, 36);       // size
  mhitBuf.writeUInt32LE(durationMs, 40);    // duration ms
  mhitBuf.writeUInt32LE(1, 44);             // track number
  mhitBuf.writeUInt32LE(2024, 48);          // year
  mhitBuf.writeUInt32LE(bitrate, 52);       // bitrate

  // mhlt
  const mhltHeaderSize = 12;
  const mhltBuf = Buffer.alloc(mhltHeaderSize);
  mhltBuf.write("mhlt", 0, 4, "ascii");
  mhltBuf.writeUInt32LE(mhltHeaderSize, 4);
  mhltBuf.writeUInt32LE(1, 8);             // 1 track

  // mhsd (type 1 = track list)
  const mhsdHeaderSize = 16;
  const mhsdChildSize = mhltHeaderSize + mhitTotalSize;
  const mhsdTotalSize = mhsdHeaderSize + mhsdChildSize;
  const mhsdBuf = Buffer.alloc(mhsdHeaderSize);
  mhsdBuf.write("mhsd", 0, 4, "ascii");
  mhsdBuf.writeUInt32LE(mhsdHeaderSize, 4);
  mhsdBuf.writeUInt32LE(mhsdTotalSize, 8);
  mhsdBuf.writeUInt32LE(1, 12);            // type 1 = tracks

  // mhbd
  const mhbdHeaderSize = 104;
  const mhbdBuf = Buffer.alloc(mhbdHeaderSize);
  mhbdBuf.write("mhbd", 0, 4, "ascii");
  mhbdBuf.writeUInt32LE(mhbdHeaderSize, 4);
  mhbdBuf.writeUInt32LE(mhbdHeaderSize + mhsdTotalSize, 8);  // total length
  mhbdBuf.writeUInt32LE(1, 12);             // unknown (always 1)
  mhbdBuf.writeUInt32LE(0x19, 16);          // version
  mhbdBuf.writeUInt32LE(1, 20);             // num children (1 mhsd)

  return Buffer.concat([mhbdBuf, mhsdBuf, mhltBuf, mhitBuf, ...mhods]);
}

describe("iTunesDB parser", () => {
  it("parses a minimal synthetic database", () => {
    const buf = buildMinimalDb({ title: "Hello", artist: "World", bitrate: 320 });
    const lib = parseItunesDb(buf);

    expect(lib.version).toBe(0x19);
    expect(lib.tracks).toHaveLength(1);

    const track = lib.tracks[0];
    expect(track.id).toBe(42);
    expect(track.title).toBe("Hello");
    expect(track.artist).toBe("World");
    expect(track.bitrate).toBe(320);
    expect(track.durationMs).toBe(180000);
    expect(track.year).toBe(2024);
    expect(track.mediaType).toBe("audio");
  });

  it("converts colon-separated paths to OS paths", () => {
    const buf = buildMinimalDb({ location: ":iPod_Control:Music:F12:WXYZ.m4a" });
    const lib = parseItunesDb(buf);
    const filePath = lib.tracks[0].filePath;
    expect(filePath).toContain("iPod_Control");
    expect(filePath).toContain("F12");
    expect(filePath).toContain("WXYZ.m4a");
    expect(filePath).not.toContain(":");
  });

  it("returns empty library for non-mhbd buffer", () => {
    const buf = Buffer.from("NOT_AN_ITDB_FILE");
    const lib = parseItunesDb(buf);
    expect(lib.tracks).toHaveLength(0);
    expect(lib.version).toBe(0);
  });

  it("returns empty library for too-short buffer", () => {
    const buf = Buffer.alloc(4);
    const lib = parseItunesDb(buf);
    expect(lib.tracks).toHaveLength(0);
  });

  it("handles empty title and artist gracefully", () => {
    const buf = buildMinimalDb({ title: "", artist: "" });
    const lib = parseItunesDb(buf);
    expect(lib.tracks[0].title).toBe("");
    expect(lib.tracks[0].artist).toBe("");
  });
});
