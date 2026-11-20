// Generate the ItemList JSON-LD for the printable library. Keep claims
// conservative: include reviewed language, grade, and description fields only
// when they exist in data/resources.js.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";
import { siteUrl } from "./lib/site-config.mjs";

const root = siteRoot;
const pagePath = join(root, "index.html");
const checkOnly = process.argv.includes("--check");
const sandbox = { window: {} };
for (const file of ["data/resources.js", "data/pdf-meta.js"]) {
  runInNewContext(readFileSync(join(root, file), "utf8"), sandbox, { filename: file });
}

const resources = sandbox.window.BOBBER_RESOURCES;
const spanishTitles = sandbox.window.BOBBER_RESOURCE_TITLES_ES || {};
const pdfMeta = sandbox.window.BOBBER_PDF_META || {};
const categoryTypes = { activity: "Activity", poster: "Poster", storybook: "Storybook" };

function assetUrl(file) {
  return `${siteUrl}/assets/${file.split("/").map(encodeURIComponent).join("/")}`;
}

function listItem(resource, index) {
  const meta = pdfMeta[resource.file] || {};
  const item = {
    "@type": "LearningResource",
    name: resource.title,
    url: assetUrl(resource.file),
    learningResourceType: categoryTypes[resource.category] || "Activity",
    isAccessibleForFree: true,
    provider: { "@id": `${siteUrl}/#organization` }
  };
  if (spanishTitles[resource.title]) item.alternateName = spanishTitles[resource.title];
  if (resource.languages?.length) item.inLanguage = resource.languages;
  if (resource.gradeRange) item.educationalLevel = resource.gradeRange;
  if (resource.description?.en) item.description = resource.description.en;
  if (meta.pages) item.numberOfPages = meta.pages;
  return { "@type": "ListItem", position: index + 1, item };
}

const schema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": `${siteUrl}/#library`,
  name: "Bobber printable library",
  description: "Free water-safety activities, posters, and storybooks from the U.S. Army Corps of Engineers, Tulsa District.",
  numberOfItems: resources.length,
  isPartOf: { "@id": `${siteUrl}/#website` },
  itemListElement: resources.map(listItem)
};

const json = JSON.stringify(schema, null, 2)
  .split("\n")
  .map((line) => `    ${line}`)
  .join("\n");
const block = `  <script type="application/ld+json" id="resource-schema">\n${json}\n  </script>`;
const html = readFileSync(pagePath, "utf8");
const marker = /(<!-- partial:resource-schema:start -->)[\s\S]*?(<!-- partial:resource-schema:end -->)/;
if (!marker.test(html)) {
  console.error("index.html is missing the resource-schema partial markers.");
  process.exit(1);
}
const next = html.replace(marker, `$1\n${block}\n  $2`);

if (checkOnly) {
  if (next !== html) {
    console.error("Resource schema is out of date. Run: npm run update:resource-schema");
    process.exit(1);
  }
  console.log(`Resource schema is current: ${resources.length} library items.`);
} else if (next !== html) {
  writeFileSync(pagePath, next);
  console.log(`Wrote resource schema with ${resources.length} library items.`);
} else {
  console.log(`Resource schema is already current: ${resources.length} library items.`);
}
