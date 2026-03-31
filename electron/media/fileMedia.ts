import path from "node:path";

/** Lowercase extensions including dot — audio + video only. */
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

export function isMediaFilePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return AUDIO_EXT.has(ext) || VIDEO_EXT.has(ext);
}

export function isVideoFilePath(filePath: string): boolean {
  return VIDEO_EXT.has(path.extname(filePath).toLowerCase());
}

export function isAudioFilePath(filePath: string): boolean {
  return AUDIO_EXT.has(path.extname(filePath).toLowerCase());
}
