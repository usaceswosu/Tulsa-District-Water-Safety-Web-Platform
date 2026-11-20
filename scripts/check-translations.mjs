// Validate the Spanish interface dictionary. The runtime language toggle
// silently falls back to English when a key is missing, so catch malformed or
// duplicate entries here before they reach a page.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";

const source = readFileSync(join(siteRoot, "data/translations.js"), "utf8");
const sandbox = { window: {} };
runInNewContext(source, sandbox, { filename: "data/translations.js" });
const dictionary = sandbox.window.BOBBER_TRANSLATIONS_ES;
const problems = [];

if (!dictionary || typeof dictionary !== "object") {
  console.error("data/translations.js did not define window.BOBBER_TRANSLATIONS_ES.");
  process.exit(1);
}

const pairs = [...source.matchAll(/^\s*"((?:[^"\\]|\\.)*)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?\s*$/gm)]
  .map((match) => ({ key: JSON.parse(`"${match[1]}"`), value: JSON.parse(`"${match[2]}"`) }));
const seen = new Set();
for (const { key, value } of pairs) {
  if (!key.trim()) problems.push("An empty translation key was found.");
  if (!value.trim()) problems.push(`"${key}" has an empty Spanish value.`);
  if (seen.has(key)) problems.push(`Duplicate translation key: "${key}".`);
  seen.add(key);
}

const runtimeKeys = Object.keys(dictionary);
if (pairs.length !== runtimeKeys.length) {
  problems.push(`Parsed ${pairs.length} entries but the runtime object has ${runtimeKeys.length}; check for malformed lines.`);
}

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Translation check passed: ${runtimeKeys.length} Spanish entries, no duplicates or empty values.`);
