// Update every local ?v= reference and regenerate the offline shell list.
// Usage: npm run bump:version -- 20261121a
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";

const next = process.argv[2];
if (!next || !/^\d{8}[a-z]$/.test(next)) {
  console.error("Usage: npm run bump:version -- YYYYMMDDx");
  process.exit(1);
}

const pages = ["index.html", "grown-ups.html"];
const versionPattern = /((?:src|href)="(?!https?:|\/\/)[^"]*?\?v=)[0-9a-z]+/g;
let changed = 0;
let matched = 0;
for (const page of pages) {
  const path = join(siteRoot, page);
  const before = readFileSync(path, "utf8");
  matched += before.match(versionPattern)?.length || 0;
  // Only local src/href values; never external URLs such as YouTube's watch?v=ID.
  const after = before.replace(versionPattern, `$1${next}`);
  if (after !== before) {
    writeFileSync(path, after);
    changed += 1;
  }
}
if (!matched) {
  console.error("No local ?v= references were found. Check the pages before bumping.");
  process.exit(1);
}

console.log(`${changed ? `Updated ${changed} page(s)` : "Pages already current"} for ?v=${next}. Regenerating precache.json…`);
execFileSync(process.execPath, [join(siteRoot, "scripts/update-precache.mjs")], { stdio: "inherit" });
execFileSync(process.execPath, [join(siteRoot, "scripts/check-versions.mjs")], { stdio: "inherit" });
