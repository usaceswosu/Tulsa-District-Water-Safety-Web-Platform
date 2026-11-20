// Move the site to a new public URL in one command.
// Usage: npm run update:site-url -- https://example.gov/bobber
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";
import { siteDisplay, siteUrl } from "./lib/site-config.mjs";

const next = (process.argv[2] || "").replace(/\/+$/, "");
if (!next || !/^https?:\/\/[^?#\s]+$/.test(next)) {
  console.error("Usage: npm run update:site-url -- https://example.gov/bobber");
  process.exit(1);
}
if (next === siteUrl) {
  console.log(`Site URL is already ${next}.`);
  process.exit(0);
}

const nextUrl = new URL(next);
const nextDisplay = `${nextUrl.host}${nextUrl.pathname.replace(/\/+$/, "")}`;
const skipDirs = new Set(["node_modules", ".git", "assets", "vendor", "test-results", "playwright-report", "blob-report"]);
const textExtensions = new Set([".html", ".md", ".xml", ".txt", ".mjs", ".js", ".json", ".yml", ".yaml", ".css"]);
let changed = 0;

function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const before = readFileSync(path, "utf8");
    const after = before.replaceAll(siteUrl, next).replaceAll(siteDisplay, nextDisplay);
    if (after !== before) {
      writeFileSync(path, after);
      changed += 1;
      console.log(`Updated ${relative(siteRoot, path)}`);
    }
  }
}
walk(siteRoot);

writeFileSync(join(siteRoot, "site.config.json"), `${JSON.stringify({ url: next }, null, 2)}\n`);
console.log(`Updated ${changed} file(s). Regenerating QR codes, sitemap, and classroom pack…`);
for (const script of ["update-resource-schema.mjs", "make-qr.mjs", "update-sitemap.mjs", "make-teacher-pack.mjs", "check-site-url.mjs"]) {
  execFileSync(process.execPath, [join(siteRoot, "scripts", script)], { stdio: "inherit" });
}
console.log("Next: run npm run bump:version -- YYYYMMDDx so the service worker and QR/classroom-pack caches refresh.");
