import { describe, expect, it } from "vitest";
import { parseSysInfoText, buildSysInfo } from "../../electron/services/ipod/sysInfoParser";

describe("SysInfo parser", () => {
  it("parses key-value pairs from SysInfo text", () => {
    const text = [
      "ModelNumStr: MA446LL",
      "pszSerialNumber: ABC123DEF456",
      "FirewireGuid: 0x0001234567890ABC",
      "visibleBuildID: 0x03020100",
      "boardHwSwInterfaceRev: 0x000B0011"
    ].join("\n");

    const fields = parseSysInfoText(text);
    expect(fields["ModelNumStr"]).toBe("MA446LL");
    expect(fields["pszSerialNumber"]).toBe("ABC123DEF456");
    expect(fields["FirewireGuid"]).toBe("0x0001234567890ABC");
  });

  it("skips blank lines and comments", () => {
    const text = "# This is a comment\n\nModelNumStr: xTest\n";
    const fields = parseSysInfoText(text);
    expect(fields["ModelNumStr"]).toBe("xTest");
    expect(Object.keys(fields)).toHaveLength(1);
  });

  it("handles empty input", () => {
    const fields = parseSysInfoText("");
    expect(Object.keys(fields)).toHaveLength(0);
  });

  it("buildSysInfo returns model info for known model", () => {
    const fields = { ModelNumStr: "MA446" };
    const info = buildSysInfo(fields);
    expect(info.modelInfo.name).toContain("iPod Video 5.5G 80GB");
    expect(info.modelInfo.family).toBe("video");
    expect(info.modelNumber).toBe("MA446");
  });

  it("buildSysInfo handles unknown model gracefully", () => {
    const fields = { ModelNumStr: "XUNKNOWN" };
    const info = buildSysInfo(fields);
    expect(info.modelInfo.name).toContain("Unknown iPod");
    expect(info.modelInfo.generation).toBe("unknown");
  });

  it("buildSysInfo handles empty fields", () => {
    const info = buildSysInfo({});
    expect(info.modelNumber).toBe("");
    expect(info.serialNumber).toBe("");
    expect(info.firmwareVersion).toBe("unknown");
  });

  it("extracts firmware version from visibleBuildID", () => {
    const fields = { visibleBuildID: "0x03020100" };
    const info = buildSysInfo(fields);
    expect(info.firmwareVersion).toBe("3.2.1");
  });
});
