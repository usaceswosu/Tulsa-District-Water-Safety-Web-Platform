// Verify that static metadata, robots, poster text, sitemap, and docs all use
// the URL in site.config.json. update-site-url.mjs is the matching writer.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";
import { siteDisplay, siteUrl } from "./lib/site-config.mjs";

const problems = [];
const read = (file) => readFileSync(join(siteRoot, file), "utf8");

function expectIncludes(file, value, label = value) {
  if (!read(file).includes(value)) problems.push(`${file} is missing ${label}.`);
}

for (const [file, path] of [
  ["index.html", "/"],
  ["grown-ups.html", "/grown-ups.html"],
  ["accessibility.html", "/accessibility.html"],
  ["poster.html", "/poster.html"]
]) {
  const canonical = `<link rel="canonical" href="${siteUrl}${path}">`;
  expectIncludes(file, canonical, `canonical URL ${siteUrl}${path}`);
}

for (const [file, path] of [
  ["index.html", "/"],
  ["grown-ups.html", "/grown-ups.html"]
]) {
  expectIncludes(file, `<meta property="og:url" content="${siteUrl}${path}">`);
  expectIncludes(file, `<link rel="alternate" hreflang="en" href="${siteUrl}${path}">`);
  expectIncludes(file, `<link rel="alternate" hreflang="es" href="${siteUrl}${path}?lang=es">`);
  expectIncludes(file, `<link rel="alternate" hreflang="x-default" href="${siteUrl}${path}">`);
}

expectIncludes("404.html", `href="${siteUrl}/assets/bobber-logo.png"`, "absolute 404 logo URL");
expectIncludes("robots.txt", `Sitemap: ${siteUrl}/sitemap.xml`, "robots sitemap URL");
expectIncludes("sitemap.xml", `<loc>${siteUrl}/</loc>`, "sitemap home URL");
expectIncludes("poster.html", `>${siteDisplay}/<`, "poster display URL");
expectIncludes("poster.html", `>${siteDisplay}/?lang=es<`, "poster Spanish display URL");

// Catch stale absolute URLs for this repository after a domain/path move.
const skipDirs = new Set(["node_modules", ".git", "assets", "vendor", "test-results", "playwright-report", "blob-report"]);
const textExtensions = new Set([".html", ".md", ".xml", ".txt", ".mjs", ".js", ".json", ".yml", ".yaml", ".css"]);
const siteHost = new URL(siteUrl).host;
const oldHost = "usaceswosu.github.io";
const repoMarker = "Tulsa-District-Water-Safety-Web-Platform";
function walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (skipDirs.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(path);
      continue;
    }
    if (!textExtensions.has(extname(entry.name))) continue;
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
      let url;
      try { url = new URL(match[0]); } catch { continue; }
      if (!url.pathname.includes(repoMarker)) continue;
      if (url.host !== siteHost && url.host !== oldHost) continue;
      if (match[0] !== siteUrl && !match[0].startsWith(`${siteUrl}/`)) {
        problems.push(`${relative(siteRoot, path)} has a stale site URL: ${match[0]}`);
      }
    }
    if (siteHost !== oldHost) {
      for (const match of text.matchAll(/usaceswosu\.github\.io\/Tulsa-District-Water-Safety-Web-Platform[^\s"'<>]*/g)) {
        problems.push(`${relative(siteRoot, path)} still shows the old GitHub Pages URL: ${match[0]}`);
      }
    }
  }
}
walk(siteRoot);

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Site URL is consistent: ${siteUrl}`);
