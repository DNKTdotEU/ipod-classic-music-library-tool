import { describe, expect, it } from "vitest";
import { MetadataService } from "../../electron/services/metadataService";

describe("MetadataService", () => {
  it("normalizes whitespace in tags", () => {
    const service = new MetadataService();
    const output = service.normalizeTags({ title: "  Hello   World ", artist: " Artist " });
    expect(output.title).toBe("Hello World");
    expect(output.artist).toBe("Artist");
  });
});
