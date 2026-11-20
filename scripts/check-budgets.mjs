// Keep the deployed shell from creeping. Text budgets use gzip because that is
// what GitHub Pages serves; the precache budget counts the files it downloads.
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { siteRoot } from "./lib/site-root.mjs";

const KB = 1024;
const budgets = [
  { label: "styles.css", file: "styles.css", limit: 20 * KB },
  { label: "scripts/main.js", file: "scripts/main.js", limit: 17 * KB },
  { label: "scripts/pdf-reader.js", file: "scripts/pdf-reader.js", limit: 8 * KB },
  { label: "data/translations.js", file: "data/translations.js", limit: 8 * KB },
  { label: "data/content.js", file: "data/content.js", limit: 4 * KB },
  { label: "index.html", file: "index.html", limit: 14 * KB }
];
const problems = [];
const results = [];

for (const budget of budgets) {
  const body = readFileSync(join(siteRoot, budget.file));
  const size = gzipSync(body, { level: 9 }).length;
  results.push(`${budget.label} ${(size / KB).toFixed(1)}/${(budget.limit / KB).toFixed(1)} KB`);
  if (size > budget.limit) {
    problems.push(`${budget.label}: ${(size / KB).toFixed(1)} KB gzip exceeds ${(budget.limit / KB).toFixed(1)} KB.`);
  }
}

// Sum the files the service worker installs, excluding directory-style URLs.
const precache = JSON.parse(readFileSync(join(siteRoot, "precache.json"), "utf8"));
let precacheBytes = 0;
for (const url of precache) {
  const pathname = decodeURIComponent(url.split("?")[0]).replace(/^\.\//, "");
  const file = pathname === "" ? "index.html" : pathname;
  try {
    precacheBytes += statSync(join(siteRoot, ...file.split("/"))).size;
  } catch {
    problems.push(`precache.json points at a missing file: ${url}`);
  }
}
const precacheLimit = 4.25 * 1024 * KB;
results.push(`precache ${(precacheBytes / 1024 / KB).toFixed(2)}/${(precacheLimit / 1024 / KB).toFixed(2)} MB`);
if (precacheBytes > precacheLimit) {
  problems.push(`precache shell: ${(precacheBytes / 1024 / KB).toFixed(2)} MB exceeds 4.25 MB.`);
}

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Asset budgets passed: ${results.join(", ")}.`);
