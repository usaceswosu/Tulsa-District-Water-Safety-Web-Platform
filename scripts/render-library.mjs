// Generate the English library cards in index.html. JavaScript adopts these
// cards on load, so matching markup keeps the no-script and scripted views in
// sync. Run `npm run update:library` after changing the catalog or PDF metadata.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";

const root = siteRoot;
const pagePath = join(root, "index.html");
const checkOnly = process.argv.includes("--check");
const sandbox = { window: {} };
for (const file of ["data/resources.js", "data/pdf-meta.js"]) {
  runInNewContext(readFileSync(join(root, file), "utf8"), sandbox, { filename: file });
}

const resources = sandbox.window.BOBBER_RESOURCES;
const categoryLabels = sandbox.window.BOBBER_CATEGORY_LABELS;
const pdfMeta = sandbox.window.BOBBER_PDF_META || {};
const LANGUAGE_NAMES = { en: "English", es: "Spanish" };
const number = new Intl.NumberFormat("en");
const decimal = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assetPath(filename) {
  return `assets/${filename.split("/").map(encodeURIComponent).join("/")}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1048576) return `${decimal.format(bytes / 1048576)} MB`;
  return `${number.format(Math.round(bytes / 1024))} KB`;
}

function formatResourceMeta(resource) {
  const meta = pdfMeta[resource.file] || {};
  const pages = Number.isFinite(meta.pages) && meta.pages > 0
    ? `${meta.pages} ${meta.pages === 1 ? "page" : "pages"}`
    : "";
  const printSize = formatFileSize(meta.bytes);
  const printLabel = printSize ? `${printSize} print` : "";
  const previewSize = meta.webFile && meta.webBytes ? formatFileSize(meta.webBytes) : "";
  const sizeLabel = previewSize
    ? `${previewSize} preview · ${printLabel}`
    : printLabel;
  return [pages, sizeLabel].filter(Boolean).join(" · ");
}

function makeCard(resource) {
  const title = escapeHtml(resource.title);
  const image = escapeHtml(assetPath(`graphics/${resource.image}`));
  const href = escapeHtml(assetPath(resource.file));
  const type = escapeHtml(categoryLabels.en[resource.category]);
  const description = escapeHtml(resource.description?.en || "");
  const languages = (resource.languages || []).filter((code) => LANGUAGE_NAMES[code]);
  const languageText = escapeHtml(languages.map((code) => LANGUAGE_NAMES[code]).join(" · "));
  const gradeText = escapeHtml(resource.gradeRange ? `Grades ${resource.gradeRange}` : "");
  const meta = escapeHtml(formatResourceMeta(resource));
  const linkLabel = resource.category === "storybook" ? "Read the story" : "Open printable PDF";
  const ariaLabel = escapeHtml(`${linkLabel}: ${resource.title}`);
  const lines = [
    `          <article class="resource-card" data-resource-file="${escapeHtml(resource.file)}">`,
    `            <div class="resource-thumb">`,
    `              <img src="${image}" alt="${title} printable preview" loading="lazy" decoding="async">`,
    `              <span class="resource-type">${type}</span>`,
    `            </div>`,
    `            <div class="resource-body">`,
    `              <h3>${title}</h3>`
  ];
  if (description) lines.push(`              <p class="resource-description">${description}</p>`);
  if (languageText || gradeText) {
    lines.push(`              <p class="resource-badges">`);
    if (languageText) lines.push(`                <span class="resource-badge">${languageText}</span>`);
    if (gradeText) lines.push(`                <span class="resource-badge">${gradeText}</span>`);
    lines.push(`              </p>`);
  }
  if (meta) lines.push(`              <p class="resource-meta">${meta}</p>`);
  lines.push(
    `              <a class="resource-link" href="${href}" target="_blank" rel="noopener" aria-haspopup="dialog" aria-label="${ariaLabel}">`,
    `                <span>${linkLabel}</span>`,
    `                <span aria-hidden="true">→</span>`,
    `              </a>`,
    `            </div>`,
    `          </article>`
  );
  return lines.join("\n");
}

const cards = resources.map(makeCard).join("\n");
const html = readFileSync(pagePath, "utf8");
const marker = /(<!-- partial:library-cards:start -->)[\s\S]*?(<!-- partial:library-cards:end -->)/;
if (!marker.test(html)) {
  console.error("index.html is missing the library-cards partial markers.");
  process.exit(1);
}
const next = html.replace(marker, `$1\n${cards}\n          $2`);

if (checkOnly) {
  if (next !== html) {
    console.error("Library cards are out of date. Run: npm run update:library");
    process.exit(1);
  }
  console.log(`Library cards are current: ${resources.length} static cards.`);
} else if (next !== html) {
  writeFileSync(pagePath, next);
  console.log(`Wrote ${resources.length} static library cards.`);
} else {
  console.log(`Library cards are already current: ${resources.length} static cards.`);
}
