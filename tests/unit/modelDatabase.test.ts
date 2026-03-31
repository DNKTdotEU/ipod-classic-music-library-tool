import { describe, expect, it } from "vitest";
import { lookupModel, type ModelInfo } from "../../electron/services/ipod/modelDatabase";

describe("lookupModel", () => {
  it("returns info for a known Classic model", () => {
    const info: ModelInfo = lookupModel("A623");
    expect(info.name).toBe("iPod Classic 6G 80GB");
    expect(info.generation).toBe("6th");
    expect(info.family).toBe("classic");
  });

  it("strips leading M prefix and still matches", () => {
    const info = lookupModel("MA623");
    expect(info.name).toBe("iPod Classic 6G 80GB");
  });

  it("strips leading P prefix and still matches", () => {
    const info = lookupModel("PA623");
    expect(info.name).toBe("iPod Classic 6G 80GB");
  });

  it("returns info for a known Nano model", () => {
    const info = lookupModel("A350");
    expect(info.name).toContain("Nano");
    expect(info.family).toBe("nano");
  });

  it("returns info for a known Mini model", () => {
    const info = lookupModel("9160");
    expect(info.name).toContain("Mini");
    expect(info.family).toBe("mini");
  });

  it("returns info for a known Shuffle model", () => {
    const info = lookupModel("9724");
    expect(info.family).toBe("shuffle");
  });

  it("returns unknown for an unrecognized model string", () => {
    const info = lookupModel("ZZZZ");
    expect(info.name).toContain("Unknown");
    expect(info.generation).toBe("unknown");
    expect(info.family).toBe("classic");
  });

  it("returns unknown with the original string in the name", () => {
    const info = lookupModel("XFOO");
    expect(info.name).toContain("XFOO");
  });
});
