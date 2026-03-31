import path from "node:path";

export type IpodTrack = {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  composer: string;
  filePath: string;
  durationMs: number;
  trackNumber: number;
  year: number;
  bitrate: number;
  sampleRate: number;
  sizeBytes: number;
  playCount: number;
  rating: number;
  mediaType: "audio" | "video" | "podcast" | "audiobook" | "unknown";
};

export type IpodLibrary = {
  version: number;
  tracks: IpodTrack[];
};

const MHOD_TYPE_TITLE = 1;
const MHOD_TYPE_LOCATION = 2;
const MHOD_TYPE_ALBUM = 3;
const MHOD_TYPE_ARTIST = 4;
const MHOD_TYPE_GENRE = 5;
const MHOD_TYPE_COMMENT = 7;
const MHOD_TYPE_COMPOSER = 12;

function readChunkType(buf: Buffer, offset: number): string {
  if (offset + 4 > buf.length) return "";
  return buf.toString("ascii", offset, offset + 4);
}

function safeU32(buf: Buffer, offset: number): number {
  if (offset + 4 > buf.length) return 0;
  return buf.readUInt32LE(offset);
}

function resolveMediaType(typeFlag: number): IpodTrack["mediaType"] {
  switch (typeFlag) {
    case 0x01: return "audio";
    case 0x02: return "video";
    case 0x04:
    case 0x06: return "podcast";
    case 0x08: return "audiobook";
    case 0x20: return "video";
    case 0x40:
    case 0x60: return "video";
    default: return typeFlag === 0 ? "audio" : "unknown";
  }
}

/**
 * Convert iTunesDB colon-separated path to OS path.
 * iTunesDB stores paths like `:iPod_Control:Music:F00:ABCD.mp3`
 */
function ipodPathToRelative(colonPath: string): string {
  const parts = colonPath.split(":").filter(Boolean);
  return parts.join(path.sep);
}

/**
 * Parse a string-type mhod (types 1-14 for metadata strings).
 * String mhods have a sub-header at offset 24 with: position (4), length (4), unknown (4), encoding (4).
 * The string data starts at offset 40.
 */
function parseMhodString(buf: Buffer, chunkStart: number): string {
  const stringHeaderStart = chunkStart + 24;
  if (stringHeaderStart + 16 > buf.length) return "";

  const stringLen = safeU32(buf, stringHeaderStart + 4);
  const encoding = safeU32(buf, stringHeaderStart + 12);
  const stringStart = chunkStart + 40;

  if (stringStart + stringLen > buf.length || stringLen === 0) return "";

  if (encoding === 2 || encoding === 0) {
    return buf.toString("utf16le", stringStart, stringStart + stringLen).replace(/\0+$/, "");
  }
  return buf.toString("utf8", stringStart, stringStart + stringLen).replace(/\0+$/, "");
}

function parseMhit(buf: Buffer, offset: number): { track: Partial<IpodTrack>; totalSize: number } {
  const headerSize = safeU32(buf, offset + 4);
  const totalSize = safeU32(buf, offset + 8);
  const numMhods = safeU32(buf, offset + 12);

  const track: Partial<IpodTrack> = {
    id: safeU32(buf, offset + 16),
    title: "",
    artist: "",
    album: "",
    genre: "",
    composer: "",
    filePath: "",
    mediaType: resolveMediaType(safeU32(buf, offset + 28)),
    rating: Math.min(100, safeU32(buf, offset + 32)),
    sizeBytes: safeU32(buf, offset + 36),
    durationMs: safeU32(buf, offset + 40),
    trackNumber: safeU32(buf, offset + 44),
    year: safeU32(buf, offset + 48),
    bitrate: safeU32(buf, offset + 52),
    sampleRate: offset + 64 <= buf.length ? safeU32(buf, offset + 60) >> 16 : 0,
    playCount: offset + 84 <= buf.length ? safeU32(buf, offset + 80) : 0
  };

  let pos = offset + headerSize;
  let mhodsParsed = 0;

  while (mhodsParsed < numMhods && pos < offset + totalSize && pos < buf.length) {
    const chunkId = readChunkType(buf, pos);
    if (chunkId !== "mhod") break;

    const mhodHeaderSize = safeU32(buf, pos + 4);
    const mhodTotalSize = safeU32(buf, pos + 8);
    if (mhodTotalSize === 0) break;

    const mhodType = safeU32(buf, pos + 12);

    if (mhodType <= 50) {
      const str = parseMhodString(buf, pos);
      switch (mhodType) {
        case MHOD_TYPE_TITLE: track.title = str; break;
        case MHOD_TYPE_LOCATION: track.filePath = ipodPathToRelative(str); break;
        case MHOD_TYPE_ALBUM: track.album = str; break;
        case MHOD_TYPE_ARTIST: track.artist = str; break;
        case MHOD_TYPE_GENRE: track.genre = str; break;
        case MHOD_TYPE_COMMENT: break;
        case MHOD_TYPE_COMPOSER: track.composer = str; break;
      }
    }

    pos += mhodTotalSize;
    mhodsParsed++;
  }

  return { track, totalSize };
}

/**
 * Parse an iTunesDB binary buffer and extract the track list.
 * This is a read-only parser that handles the mhbd > mhsd > mhlt > mhit > mhod hierarchy.
 */
export function parseItunesDb(buf: Buffer): IpodLibrary {
  if (buf.length < 12) {
    return { version: 0, tracks: [] };
  }

  const rootType = readChunkType(buf, 0);
  if (rootType !== "mhbd") {
    return { version: 0, tracks: [] };
  }

  const mhbdHeaderSize = safeU32(buf, 4);
  const version = safeU32(buf, 16);
  const numChildren = safeU32(buf, 20);

  const tracks: IpodTrack[] = [];
  let pos = mhbdHeaderSize;

  for (let child = 0; child < numChildren && pos < buf.length; child++) {
    const chunkId = readChunkType(buf, pos);
    if (chunkId !== "mhsd") {
      const size = safeU32(buf, pos + 8);
      pos += size > 0 ? size : 1;
      continue;
    }

    const mhsdHeaderSize = safeU32(buf, pos + 4);
    const mhsdTotalSize = safeU32(buf, pos + 8);
    const datasetType = safeU32(buf, pos + 12);

    if (datasetType === 1) {
      let mhltPos = pos + mhsdHeaderSize;
      const mhltType = readChunkType(buf, mhltPos);
      if (mhltType === "mhlt") {
        const mhltHeaderSize = safeU32(buf, mhltPos + 4);
        const numTracks = safeU32(buf, mhltPos + 8);
        let trackPos = mhltPos + mhltHeaderSize;

        for (let t = 0; t < numTracks && trackPos < buf.length; t++) {
          const tType = readChunkType(buf, trackPos);
          if (tType !== "mhit") break;

          const { track, totalSize } = parseMhit(buf, trackPos);
          tracks.push({
            id: track.id ?? 0,
            title: track.title ?? "",
            artist: track.artist ?? "",
            album: track.album ?? "",
            genre: track.genre ?? "",
            composer: track.composer ?? "",
            filePath: track.filePath ?? "",
            durationMs: track.durationMs ?? 0,
            trackNumber: track.trackNumber ?? 0,
            year: track.year ?? 0,
            bitrate: track.bitrate ?? 0,
            sampleRate: track.sampleRate ?? 0,
            sizeBytes: track.sizeBytes ?? 0,
            playCount: track.playCount ?? 0,
            rating: track.rating ?? 0,
            mediaType: track.mediaType ?? "unknown"
          });

          trackPos += totalSize > 0 ? totalSize : 1;
        }
      }
    }

    pos += mhsdTotalSize > 0 ? mhsdTotalSize : 1;
  }

  return { version, tracks };
}
