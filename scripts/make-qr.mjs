// Generate print-ready QR codes for the site and its Spanish entry point.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import QRCode from "qrcode";
import { siteRoot } from "./lib/site-root.mjs";
import { siteUrl } from "./lib/site-config.mjs";

const root = siteRoot;
const site = `${siteUrl}/`;
const targets = [
  { file: "assets/qr/bobber-site.svg", url: site },
  { file: "assets/qr/bobber-site-es.svg", url: `${site}?lang=es` }
];

mkdirSync(join(root, "assets/qr"), { recursive: true });
for (const target of targets) {
  const svg = await QRCode.toString(target.url, {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2,
    width: 512,
    color: { dark: "#123c45", light: "#ffffff" }
  });
  writeFileSync(join(root, target.file), svg);
  console.log(`Wrote ${target.file} for ${target.url}`);
}
