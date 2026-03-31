import fs from "node:fs/promises";
import path from "node:path";
import { lookupModel, type ModelInfo } from "./modelDatabase.js";

export type SysInfoData = {
  raw: Record<string, string>;
  modelNumber: string;
  modelInfo: ModelInfo;
  firewireGuid: string;
  serialNumber: string;
  firmwareVersion: string;
  boardHwSwInterfaceRev: string;
};

/**
 * Parse the iPod SysInfo file (plain-text key: value pairs).
 * Located at `<mount>/iPod_Control/Device/SysInfo`.
 */
export function parseSysInfoText(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

function extractFirmwareVersion(buildIdStr: string): string {
  if (!buildIdStr) return "unknown";
  const num = parseInt(buildIdStr, 16);
  if (isNaN(num)) return buildIdStr;
  const major = (num >>> 24) & 0xff;
  const minor = (num >>> 16) & 0xff;
  const patch = (num >>> 8) & 0xff;
  return `${major}.${minor}.${patch}`;
}

export function buildSysInfo(fields: Record<string, string>): SysInfoData {
  const modelNumber = fields["ModelNumStr"] ?? fields["modelNumStr"] ?? "";
  return {
    raw: fields,
    modelNumber,
    modelInfo: lookupModel(modelNumber),
    firewireGuid: fields["FirewireGuid"] ?? fields["firewireGuid"] ?? "",
    serialNumber: fields["pszSerialNumber"] ?? fields["SerialNumber"] ?? "",
    firmwareVersion: extractFirmwareVersion(fields["visibleBuildID"] ?? fields["buildID"] ?? ""),
    boardHwSwInterfaceRev: fields["boardHwSwInterfaceRev"] ?? ""
  };
}

export async function readSysInfo(mountPath: string): Promise<SysInfoData> {
  const sysInfoPath = path.join(mountPath, "iPod_Control", "Device", "SysInfo");
  try {
    const text = await fs.readFile(sysInfoPath, "utf8");
    const fields = parseSysInfoText(text);
    return buildSysInfo(fields);
  } catch {
    return buildSysInfo({});
  }
}
