// Guard against accidentally shipping huge PDFs.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";

const root = siteRoot;
const MB = 1048576;
const readPdfs = (dir) =>
  readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .map((name) => ({ name, bytes: statSync(join(dir, name)).size }));

const print = readPdfs(join(root, "assets/pdfs"));
const preview = readPdfs(join(root, "assets/pdfs/web"));
const downloadsDir = join(root, "assets/downloads");
const downloads = existsSync(downloadsDir)
  ? readdirSync(downloadsDir).filter((name) => name.toLowerCase().endsWith(".zip")).map((name) => ({ name, bytes: statSync(join(downloadsDir, name)).size }))
  : [];
const total = (files) => files.reduce((sum, file) => sum + file.bytes, 0);
const largest = (files) => files.reduce((max, file) => Math.max(max, file.bytes), 0);
const limits = {
  printMax: 22 * MB,
  printTotal: 95 * MB,
  previewMax: 11 * MB,
  previewTotal: 30 * MB,
  downloadMax: 25 * MB
};
const problems = [];
for (const file of preview) {
  const printName = file.name.replace(/-web\.pdf$/i, ".pdf");
  if (!existsSync(join(root, "assets/pdfs", printName))) {
    problems.push(`Preview has no matching print PDF: ${file.name}`);
  }
}
if (largest(print) > limits.printMax) problems.push(`Largest print PDF is ${(largest(print) / MB).toFixed(1)} MB (limit 22 MB).`);
if (total(print) > limits.printTotal) problems.push(`Print PDFs total ${(total(print) / MB).toFixed(1)} MB (limit 95 MB).`);
if (largest(preview) > limits.previewMax) problems.push(`Largest preview is ${(largest(preview) / MB).toFixed(1)} MB (limit 11 MB).`);
if (total(preview) > limits.previewTotal) problems.push(`Previews total ${(total(preview) / MB).toFixed(1)} MB (limit 30 MB).`);
if (largest(downloads) > limits.downloadMax) problems.push(`Largest download is ${(largest(downloads) / MB).toFixed(1)} MB (limit 25 MB).`);

console.log(
  `PDF budget: ${print.length} print files ${(total(print) / MB).toFixed(1)} MB, ` +
    `${preview.length} previews ${(total(preview) / MB).toFixed(1)} MB, ` +
    `largest ${(largest(print) / MB).toFixed(1)} MB; ` +
    `${downloads.length} download archive(s) ${(total(downloads) / MB).toFixed(1)} MB.`
);
if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
