export type MetadataNormalizationPreview = {
  path: string;
  before: Record<string, string>;
  after: Record<string, string>;
};

export class MetadataService {
  normalizeTags(input: Record<string, string>): Record<string, string> {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      normalized[key] = value.trim().replace(/\s+/g, " ");
    }
    return normalized;
  }

  previewBatchNormalization(paths: string[]): MetadataNormalizationPreview[] {
    return paths.map((path) => ({
      path,
      before: { title: "  Demo  Track  ", artist: " Demo Artist " },
      after: { title: "Demo Track", artist: "Demo Artist" }
    }));
  }
}
