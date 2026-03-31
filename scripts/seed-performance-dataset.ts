import fs from "node:fs";
import path from "node:path";

const total = 100000;
const rows: string[] = [];
for (let i = 0; i < total; i += 1) {
  rows.push(
    JSON.stringify({
      path: `/music/library/track-${String(i).padStart(6, "0")}.mp3`,
      title: `Track ${i % 20000}`,
      artist: `Artist ${i % 3000}`,
      album: `Album ${i % 1500}`,
      durationSec: 180 + (i % 120),
      sizeBytes: 3_000_000 + (i % 2_000_000)
    })
  );
}

const out = path.join(process.cwd(), "fixtures", "perf-dataset.ndjson");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, rows.join("\n"));
console.log(`Generated ${total} rows at ${out}`);
