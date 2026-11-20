// Build the classroom ZIP from the print-quality PDFs and the QR codes.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import JSZip from "jszip";
import { siteRoot } from "./lib/site-root.mjs";
import { siteUrl } from "./lib/site-config.mjs";

const root = siteRoot;
const checkOnly = process.argv.includes("--check");
const outputDir = join(root, "assets/downloads");
const output = join(outputDir, "Bobber_Classroom_Pack_2026.zip");
const folderName = "Bobber_Classroom_Pack";

const files = [
  ["01-Bobber-PFD-Lesson.pdf", "assets/pdfs/Bobber and PFD Program.pdf"],
  ["02-Bobber-Golden-Rules.pdf", "assets/pdfs/Bobber Water Safety Golden Rules.pdf"],
  ["03-Bobber-Activity-Book.pdf", "assets/pdfs/Bobber Activity Book.pdf"],
  ["04-Bobber-Bookmarks.pdf", "assets/pdfs/Bobber Bookmarks Activity Sheets.pdf"],
  ["05-Life-Jacket-Coloring.pdf", "assets/pdfs/Bobber Life Jacket Coloring Sheet.pdf"],
  ["06-Water-Safety-Resource-Guide.pdf", "assets/pdfs/Water Safety Resource Guide 2021.pdf"],
  ["QR-English.svg", "assets/qr/bobber-site.svg"],
  ["QR-Spanish.svg", "assets/qr/bobber-site-es.svg"]
];

for (const [, source] of files) {
  if (!existsSync(join(root, source))) {
    console.error(`Missing source file: ${source}. Run npm run update:qr first.`);
    process.exit(1);
  }
}

const readme = `Bobber the Water Safety Dog — Classroom Pack
U.S. Army Corps of Engineers, Tulsa District
Built by the SWOSU student team credited on the website.

Included:
- PFD lesson outline
- Bobber's Golden Rules lesson
- Bobber Activity Book
- Bookmarks
- Life-jacket coloring sheet
- Water Safety Resource Guide
- English and Spanish QR codes for the website

Website: ${siteUrl}/
Spanish: ${siteUrl}/?lang=es
QR poster: ${siteUrl}/poster.html
Accessibility and privacy: ${siteUrl}/accessibility.html

Print the PDFs at 100% / actual size. The website has the full library of posters,
coloring sheets, storybooks, and the printable Safety Hero certificate.

These are official USACE program materials; check the Bobber program page for updates.
`;

if (checkOnly) {
  const problems = [];
  if (!existsSync(output)) {
    problems.push("Classroom pack is missing. Run: npm run update:teacher-pack");
  } else {
    const archive = await JSZip.loadAsync(readFileSync(output));
    for (const [name, source] of files) {
      const entry = archive.file(`${folderName}/${name}`);
      if (!entry) {
        problems.push(`Classroom pack is missing ${name}.`);
      } else if (!(await entry.async("nodebuffer")).equals(readFileSync(join(root, source)))) {
        problems.push(`Classroom pack has a stale copy of ${name}.`);
      }
    }
    const readmeEntry = archive.file(`${folderName}/README.txt`);
    if (!readmeEntry) problems.push("Classroom pack is missing README.txt.");
    else if ((await readmeEntry.async("string")) !== readme) problems.push("Classroom pack README is out of date.");
  }
  if (problems.length) {
    console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
    process.exit(1);
  }
  console.log(`Classroom pack is current (${files.length} files + README).`);
} else {
  const zip = new JSZip();
  const folder = zip.folder(folderName);
  for (const [name, source] of files) {
    folder.file(name, readFileSync(join(root, source)), { compression: "STORE" });
  }
  folder.file("README.txt", readme, { compression: "DEFLATE" });

  mkdirSync(outputDir, { recursive: true });
  const content = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 }
  });
  writeFileSync(output, content);
  console.log(`Wrote ${output} (${(statSync(output).size / 1048576).toFixed(1)} MB) with ${files.length} files + README.`);
}
