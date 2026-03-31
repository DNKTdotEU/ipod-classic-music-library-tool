/** Client-side checks (keep in sync with `electron/media/fileMedia.ts`). */

const AUDIO_EXT = new Set([
  ".mp3",
  ".flac",
  ".m4a",
  ".aac",
  ".wav",
  ".ogg",
  ".opus",
  ".aiff",
  ".wma"
]);

const VIDEO_EXT = new Set([".mp4", ".m4v", ".mov", ".webm", ".mkv", ".avi", ".mpg", ".mpeg"]);

function ext(p: string): string {
  const i = p.lastIndexOf(".");
  return i >= 0 ? p.slice(i).toLowerCase() : "";
}

export function isMediaFilePath(filePath: string): boolean {
  const e = ext(filePath);
  return AUDIO_EXT.has(e) || VIDEO_EXT.has(e);
}

export function isVideoFilePath(filePath: string): boolean {
  return VIDEO_EXT.has(ext(filePath));
}
