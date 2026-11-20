// The site uses classic scripts, which share one global scope. Catch duplicate
// top-level names that would throw at load time (or silently overwrite a function).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";

// Load order on the home page. Data files are included because they share the
// same classic-script global scope as the reader and controller.
const files = [
  "scripts/pdf-reader.js",
  "data/resources.js",
  "data/content.js",
  "data/pdf-meta.js",
  "data/translations.js",
  "scripts/main.js"
];

const declarationPattern = /^(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)|^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
const owners = new Map();
const problems = [];
const sources = [];

for (const file of files) {
  const source = readFileSync(join(siteRoot, file), "utf8");
  sources.push(`// ${file}\n${source}`);
  for (const match of source.matchAll(declarationPattern)) {
    const name = match[1] || match[2];
    if (owners.has(name)) {
      problems.push(`${name} is declared in both ${owners.get(name)} and ${file}.`);
    } else {
      owners.set(name, file);
    }
  }
}

try {
  new Script(sources.join("\n"), { filename: "combined-browser-scripts.js" });
} catch (error) {
  problems.push(`Combined browser scripts do not compile: ${error.message}`);
}

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Global check passed: ${owners.size} top-level names are unique across ${files.length} classic scripts.`);
