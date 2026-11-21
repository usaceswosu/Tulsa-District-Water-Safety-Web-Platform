// Inventory print PDFs for basic screen-reader signals: extractable text and
// MarkInfo /Marked. This is a triage report, not a Section 508 conformance test.
// Usage: npm run report:pdf-accessibility [-- --write]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { siteRoot } from "./lib/site-root.mjs";

const dir = join(siteRoot, "assets/pdfs");
const files = readdirSync(dir)
  .filter((name) => name.toLowerCase().endsWith(".pdf"))
  .sort((a, b) => a.localeCompare(b, "en"));
const rows = [];

for (const name of files) {
  try {
    const task = getDocument({
      data: new Uint8Array(readFileSync(join(dir, name))),
      disableWorker: true,
      isEvalSupported: false,
      verbosity: 0
    });
    const document = await task.promise;
    const samplePages = Math.min(document.numPages, 3);
    let characters = 0;
    for (let pageNumber = 1; pageNumber <= samplePages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent();
      characters += text.items.reduce((sum, item) => sum + (item.str || "").replace(/\s+/g, "").length, 0);
    }
    let marked = null;
    try {
      const markInfo = await document.getMarkInfo();
      marked = markInfo?.get ? markInfo.get("Marked") : markInfo?.Marked;
    } catch {
      // Leave unknown when the PDF cannot report MarkInfo.
    }
    const metadata = await document.getMetadata().catch(() => null);
    rows.push({
      name,
      pages: document.numPages,
      charactersPerPage: Math.round(characters / samplePages),
      marked,
      language: metadata?.info?.Language || "",
      title: metadata?.info?.Title || ""
    });
    await task.destroy();
  } catch (error) {
    rows.push({ name, error: error.message });
  }
}

rows.sort((a, b) => (a.charactersPerPage ?? -1) - (b.charactersPerPage ?? -1));
const lowText = rows.filter((row) => row.charactersPerPage != null && row.charactersPerPage <= 50);
const marked = rows.filter((row) => row.marked === true);
const unmarked = rows.filter((row) => row.marked !== true);
const dateParts = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date()).map((part) => [part.type, part.value])
);
const auditDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

const lines = [
  "# PDF accessibility inventory",
  "",
  `Audited ${auditDate} with PDF.js. This is a triage inventory, not a Section 508 conformance claim.`,
  "",
  `- **${rows.length} print PDFs**`,
  `- **${marked.length}** report \`MarkInfo /Marked = true\``,
  `- **${unmarked.length}** are unmarked or do not report MarkInfo`,
  `- **${lowText.length}** have 50 or fewer extractable characters per sampled page`,
  "",
  "This inventory covers print PDFs only. Reader previews are rasterized by design and are not included. Text is sampled from the first three pages of each file.",
  "",
  "Extractable text and structure tags do not guarantee useful alt text, reading order, or table semantics. Those still need review in a PDF accessibility tool.",
  "",
  "## Priority files",
  "",
  "| File | Pages | Characters/page | Marked | Language |",
  "| --- | ---: | ---: | --- | --- |"
];
for (const row of lowText) {
  lines.push(`| ${row.name.replaceAll("|", "\\|")} | ${row.pages} | ${row.charactersPerPage} | ${row.marked === true ? "yes" : "no"} | ${row.language || "unknown"} |`);
}
lines.push(
  "",
  "Recommended next steps:",
  "",
  "1. Replace or remediate the priority storybooks/posters with tagged, text-based PDFs.",
  "2. Add page-level alt text or an accessible HTML summary for image-only activities.",
  "3. Re-run this report and verify each repaired file in a PDF accessibility checker.",
  "",
  "## All print PDFs",
  "",
  "| File | Pages | Characters/page | Marked | Language |",
  "| --- | ---: | ---: | --- | --- |"
);
for (const row of rows) {
  if (row.error) {
    lines.push(`| ${row.name.replaceAll("|", "\\|")} | — | — | — | error: ${row.error.replaceAll("|", "\\|")} |`);
  } else {
    lines.push(`| ${row.name.replaceAll("|", "\\|")} | ${row.pages} | ${row.charactersPerPage} | ${row.marked === true ? "yes" : "no"} | ${row.language || "unknown"} |`);
  }
}
lines.push("");
const report = lines.join("\n");

if (process.argv.includes("--write")) {
  writeFileSync(join(siteRoot, "PDF_ACCESSIBILITY.md"), report);
  console.log(`Wrote PDF_ACCESSIBILITY.md: ${rows.length} PDFs, ${marked.length} marked, ${lowText.length} low-text.`);
} else {
  console.log(`PDF accessibility: ${rows.length} PDFs, ${marked.length} marked, ${lowText.length} low-text.`);
  for (const row of lowText) console.log(` - ${row.name}: ${row.charactersPerPage} chars/page, marked=${row.marked === true}`);
}
