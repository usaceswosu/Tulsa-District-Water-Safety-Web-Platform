// Shared repository root for Node maintenance scripts.
// fileURLToPath avoids percent-encoding issues when a checkout path contains spaces.
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const siteRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
