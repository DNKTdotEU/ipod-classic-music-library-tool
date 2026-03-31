import fs from "node:fs";
import path from "node:path";

const checklist = path.join(process.cwd(), "docs", "release-checklist.md");
if (!fs.existsSync(checklist)) {
  console.error("Missing docs/release-checklist.md");
  process.exit(1);
}

const text = fs.readFileSync(checklist, "utf8");
const total = (text.match(/- \[ \]/g) ?? []).length;
const completed = (text.match(/- \[x\]/gi) ?? []).length;
const releaseDocExists = fs.existsSync(path.join(process.cwd(), "RELEASE.md"));
const changelogExists = fs.existsSync(path.join(process.cwd(), "CHANGELOG.md"));
const noticeExists = fs.existsSync(path.join(process.cwd(), "NOTICE"));

console.log(
  JSON.stringify(
    {
      checklist,
      totalItems: total + completed,
      completedItems: completed,
      pendingItems: total,
      releaseDocExists,
      changelogExists,
      noticeExists,
      readyToRelease: total === 0 && releaseDocExists && changelogExists && noticeExists
    },
    null,
    2
  )
);
