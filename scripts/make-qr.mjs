// Generate print-ready QR codes for the site and its Spanish entry point.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { siteRoot } from "./lib/site-root.mjs";
import { siteUrl } from "./lib/site-config.mjs";

const root = siteRoot;
const checkOnly = process.argv.includes("--check");
const site = `${siteUrl}/`;
const targets = [
  { file: "assets/qr/bobber-site.svg", url: site },
  { file: "assets/qr/bobber-site-es.svg", url: `${site}?lang=es` }
];

mkdirSync(join(root, "assets/qr"), { recursive: true });
const stale = [];
for (const target of targets) {
  const svg = await QRCode.toString(target.url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: { dark: "#123c45", light: "#ffffff" }
  });
  const path = join(root, target.file);
  if (checkOnly) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== svg) stale.push(target.file);
  } else {
    writeFileSync(path, svg);
    console.log(`Wrote ${target.file} for ${target.url}`);
  }
}
if (checkOnly) {
  if (stale.length) {
    console.error(`QR codes are out of date: ${stale.join(", ")}. Run: npm run update:qr`);
    process.exit(1);
  }
  console.log(`QR codes are current for ${siteUrl}.`);
}
