// Generate sitemap.xml from site.config.json and the current asset version date.
// Usage: node scripts/update-sitemap.mjs [--check] [--date YYYY-MM-DD]
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";
import { siteUrl } from "./lib/site-config.mjs";

const checkOnly = process.argv.includes("--check");
const dateArgIndex = process.argv.indexOf("--date");
const dateArg = dateArgIndex >= 0 ? process.argv[dateArgIndex + 1] : null;

function versionDate() {
  const html = readFileSync(join(siteRoot, "index.html"), "utf8");
  const match = html.match(/main\.js\?v=(\d{4})(\d{2})(\d{2})[a-z]/);
  if (!match) return new Date().toISOString().slice(0, 10);
  return `${match[1]}-${match[2]}-${match[3]}`;
}

const lastmod = dateArg || versionDate();
if (!/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
  console.error("Sitemap date must look like YYYY-MM-DD.");
  process.exit(1);
}

const pages = [
  { loc: `${siteUrl}/`, alternates: true },
  { loc: `${siteUrl}/grown-ups.html`, alternates: true },
  { loc: `${siteUrl}/accessibility.html` },
  { loc: `${siteUrl}/poster.html` }
];

const urls = pages.map(({ loc, alternates }) => {
  const lines = [`  <url>`, `    <loc>${loc}</loc>`, `    <lastmod>${lastmod}</lastmod>`];
  if (alternates) {
    const suffix = loc.slice(siteUrl.length);
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="en" href="${siteUrl}${suffix}"/>`,
      `    <xhtml:link rel="alternate" hreflang="es" href="${siteUrl}${suffix}?lang=es"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}${suffix}"/>`
    );
  }
  lines.push("  </url>");
  return lines.join("\n");
});

const content = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
const path = join(siteRoot, "sitemap.xml");
const current = existsSync(path) ? readFileSync(path, "utf8") : "";

if (checkOnly) {
  if (current !== content) {
    console.error("sitemap.xml is out of date. Run: npm run update:sitemap");
    process.exit(1);
  }
  console.log(`Sitemap is current: ${pages.length} URLs, lastmod ${lastmod}.`);
} else {
  writeFileSync(path, content);
  console.log(`Wrote sitemap.xml with ${pages.length} URLs, lastmod ${lastmod}.`);
}
