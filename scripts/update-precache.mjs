// Generate the offline shell list. PDFs and the classroom ZIP are intentionally
// excluded; they are large and need a live connection for the reader/download.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const output = join(root, "precache.json");
const checkOnly = process.argv.includes("--check");
const pages = ["index.html", "grown-ups.html", "accessibility.html", "poster.html", "404.html"];
const urls = new Set([
  "./",
  "./index.html",
  "./grown-ups.html",
  "./accessibility.html",
  "./poster.html",
  "./404.html",
  "./manifest.webmanifest"
]);

for (const page of pages) {
  const html = readFileSync(join(root, page), "utf8");
  for (const match of html.matchAll(/(?:src|href)="([^"]+\.(?:css|js|mjs)(?:\?[^"]*)?)"/g)) {
    if (!/^(?:https?:|data:|#)/.test(match[1])) urls.add(`./${match[1]}`);
  }
  for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const candidate of match[1].split(",")) {
      const path = candidate.trim().split(/\s+/)[0];
      if (path && !/^(?:https?:|data:)/.test(path)) urls.add(`./${path}`);
    }
  }
}

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (path.includes(`${join("assets", "pdfs")}`) || path.includes(`${join("assets", "downloads")}`)) continue;
      walk(path);
    } else if (/\.(?:webp|png|jpe?g|gif|svg|ico|avif)$/i.test(entry.name)) {
      urls.add(`./${relative(root, path).replaceAll("\\", "/")}`);
    }
  }
}
walk(join(root, "assets"));

const list = [...urls].map((url) => encodeURI(url)).sort((a, b) => a.localeCompare(b));
const content = `${JSON.stringify(list, null, 2)}\n`;
const current = existsSync(output) ? readFileSync(output, "utf8") : "";
if (checkOnly) {
  if (current !== content) {
    console.error("precache.json is out of date. Run: npm run update:precache");
    process.exit(1);
  }
  console.log(`Precache list is current: ${list.length} URLs.`);
} else {
  writeFileSync(output, content);
  console.log(`Wrote precache.json with ${list.length} URLs.`);
}
