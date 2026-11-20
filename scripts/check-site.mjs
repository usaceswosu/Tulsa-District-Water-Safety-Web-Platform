// Cross-platform port of scripts/check-site.ps1.
// Validates local references, fragments, catalog assets, and page wiring without
// requiring PowerShell. The PowerShell version can stay in CI as a second opinion.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";

const problems = [];
const pages = readdirSync(siteRoot)
  .filter((name) => name.endsWith(".html"))
  .sort((a, b) => a.localeCompare(b));

function fail(message) {
  problems.push(message);
}

function idsIn(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
}

function skipReference(url) {
  return /^(?:https?:|\/\/|mailto:|tel:|#|data:|javascript:)/.test(url);
}

function resolveLocal(url) {
  try {
    const pathname = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\/+/, "");
    return join(siteRoot, ...pathname.split("/"));
  } catch {
    return "";
  }
}

const styles = readFileSync(join(siteRoot, "styles.css"), "utf8");
if (!styles.includes(":focus-visible")) fail("styles.css is missing visible keyboard focus styles.");
if (!styles.includes("prefers-reduced-motion")) fail("styles.css is missing reduced-motion support.");

const scriptOrder = {
  "index.html": [
    "scripts/pdf-reader.js",
    "data/resources.js",
    "data/content.js",
    "data/pdf-meta.js",
    "data/translations.js",
    "scripts/main.js"
  ],
  "grown-ups.html": [
    "scripts/pdf-reader.js",
    "data/resources.js",
    "data/translations.js",
    "scripts/main.js"
  ]
};

let localReferences = 0;
for (const page of pages) {
  const html = readFileSync(join(siteRoot, page), "utf8");
  const ids = idsIn(html);

  if (!/<html\s+lang="en"/.test(html)) fail(`${page} must declare its default document language.`);
  if (!/<main\b/.test(html)) fail(`${page} is missing its main landmark.`);
  if (!/class="skip-link"/.test(html)) fail(`${page} is missing the skip link.`);
  if (/<script\b[^>]*src="https?:\/\/|<link\b[^>]*rel="stylesheet"[^>]*href="https?:\/\/|<link\b[^>]*href="https?:\/\/fonts\./.test(html)) {
    fail(`${page} should not require remote scripts, stylesheets, or fonts to render.`);
  }

  const duplicates = [...html.matchAll(/\bid="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((id, index, all) => all.indexOf(id) !== index);
  for (const id of new Set(duplicates)) fail(`Duplicate HTML id in ${page}: ${id}`);

  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.has(match[1])) fail(`Broken in-page link in ${page}: #${match[1]}`);
  }

  for (const match of html.matchAll(/href="([^"#]+)#([^"]+)"/g)) {
    const target = match[1];
    if (skipReference(target)) continue;
    const targetPath = resolveLocal(target);
    if (!existsSync(targetPath) || !statSync(targetPath).isFile()) continue;
    if (!idsIn(readFileSync(targetPath, "utf8")).has(match[2])) {
      fail(`Broken cross-page link in ${page}: ${target}#${match[2]}`);
    }
  }

  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (skipReference(url)) continue;
    localReferences += 1;
    if (!existsSync(resolveLocal(url)) || !statSync(resolveLocal(url)).isFile()) {
      fail(`Missing local asset in ${page}: ${url}`);
    }
  }

  if (scriptOrder[page]) {
    let previous = -1;
    for (const script of scriptOrder[page]) {
      const index = html.indexOf(`<script src="${script}`);
      if (index < 0 || index <= previous) {
        fail(`Missing or out-of-order app script in ${page}: ${script}`);
      }
      previous = index;
    }
  }
}

const dataSource = readFileSync(join(siteRoot, "data/resources.js"), "utf8");
const sandbox = { window: {} };
runInNewContext(dataSource, sandbox, { filename: "data/resources.js" });
const resources = sandbox.window.BOBBER_RESOURCES;
const spanishTitles = sandbox.window.BOBBER_RESOURCE_TITLES_ES;

if (!Array.isArray(resources) || !resources.length) {
  fail("The shared resource data could not be read.");
} else {
  const seenTitles = new Set();
  for (const resource of resources) {
    if (seenTitles.has(resource.title)) fail(`Duplicate resource title: ${resource.title}`);
    seenTitles.add(resource.title);
    if (!["activity", "poster", "storybook"].includes(resource.category)) {
      fail(`Unknown resource category for ${resource.title}`);
    }
    if (!resource.file || !resource.image) {
      fail(`Resource is missing a file or image path: ${resource.title}`);
      continue;
    }
    for (const relativeFile of [resource.file, `graphics/${resource.image}`]) {
      const path = join(siteRoot, "assets", ...relativeFile.split("/"));
      if (!existsSync(path)) fail(`Missing resource asset for ${resource.title}: ${relativeFile}`);
    }
    if (!spanishTitles || !(resource.title in spanishTitles)) {
      fail(`Missing Spanish display title for ${resource.title}`);
    }
  }
}

const pdfDir = join(siteRoot, "assets/pdfs");
const pdfCount = readdirSync(pdfDir).filter((name) => name.toLowerCase().endsWith(".pdf")).length;
if (pdfCount < 1) fail("No local PDFs were found in assets/pdfs/.");
if (!existsSync(join(siteRoot, "CONTENT_REVIEW.md"))) fail("CONTENT_REVIEW.md is missing.");

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(
  `Site checks passed: ${resources.length} catalog records, ` +
    `${localReferences} local HTML references, and ${pdfCount} local PDFs.`
);
