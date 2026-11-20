// Fill in intrinsic width/height on local <img> tags to avoid layout shifts.
// Run `npm run update:image-dimensions` after adding or replacing images.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pages = ["index.html", "grown-ups.html", "404.html"];

for (const page of pages) {
  const pagePath = join(root, page);
  if (!existsSync(pagePath)) continue;
  let html = readFileSync(pagePath, "utf8");
  let changed = 0;
  html = html.replace(/<img\b[^>]*>/g, (tag) => {
    if (/\bwidth=/.test(tag) && /\bheight=/.test(tag)) return tag;
    const src = tag.match(/\bsrc="([^"]+)"/)?.[1];
    if (!src || /^(https?:|data:)/.test(src)) return tag;
    const file = join(root, decodeURIComponent(src.split("?")[0].split("#")[0]));
    if (!existsSync(file)) return tag;
    let size;
    try {
      size = imageSize(readFileSync(file));
    } catch {
      return tag;
    }
    if (!size?.width || !size?.height) return tag;
    changed += 1;
    return tag.replace(/\s*\/?>$/, (end) => ` width="${size.width}" height="${size.height}"${end}`);
  });
  if (changed) {
    writeFileSync(pagePath, html);
    console.log(`${page}: added dimensions to ${changed} image${changed === 1 ? "" : "s"}`);
  }
}
