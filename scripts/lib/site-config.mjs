// Single source of truth for the public site URL.
// Browser pages still contain static absolute metadata; update-site-url.mjs
// rewrites those references and regenerates QR/sitemap/pack artifacts.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./site-root.mjs";

const configPath = join(siteRoot, "site.config.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));

if (typeof config.url !== "string" || !/^https?:\/\//.test(config.url)) {
  throw new Error("site.config.json must contain a valid http(s) url.");
}

export const siteUrl = config.url.replace(/\/+$/, "");
const parsed = new URL(siteUrl);
export const siteDisplay = `${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
