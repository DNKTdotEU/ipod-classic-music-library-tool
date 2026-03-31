import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

const file = path.join(process.cwd(), "fixtures", "perf-dataset.ndjson");
if (!fs.existsSync(file)) {
  console.error("Missing perf dataset. Run npm run perf:seed first.");
  process.exit(1);
}

const t0 = performance.now();
const content = fs.readFileSync(file, "utf8");
const t1 = performance.now();

const lines = content.split("\n");
const parseStart = performance.now();
const parsed = lines.filter(Boolean).map((line) => JSON.parse(line) as { title: string; artist: string });
const parseEnd = performance.now();

const aggregateStart = performance.now();
const groups = new Map<string, number>();
for (const item of parsed) {
  const key = `${item.artist}|${item.title}`;
  groups.set(key, (groups.get(key) ?? 0) + 1);
}
const aggregateEnd = performance.now();

console.log(
  JSON.stringify(
    {
      datasetRows: parsed.length,
      readMs: +(t1 - t0).toFixed(2),
      parseMs: +(parseEnd - parseStart).toFixed(2),
      aggregateMs: +(aggregateEnd - aggregateStart).toFixed(2),
      totalMs: +(aggregateEnd - t0).toFixed(2),
      uniqueArtistTitlePairs: groups.size
    },
    null,
    2
  )
);
