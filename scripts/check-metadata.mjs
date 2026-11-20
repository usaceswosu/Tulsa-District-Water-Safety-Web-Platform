// Validate optional reviewed resource metadata. Missing fields are allowed
// until the district review is complete; use --require to gate publication.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";

const requireAll = process.argv.includes("--require");
const sandbox = { window: {} };
runInNewContext(readFileSync(join(siteRoot, "data/resources.js"), "utf8"), sandbox, { filename: "data/resources.js" });
const resources = sandbox.window.BOBBER_RESOURCES;
const problems = [];
const coverage = { languages: 0, gradeRange: 0, description: 0 };

// Keep the review template aligned with the live catalog.
const reviewRows = readFileSync(join(siteRoot, "data/resource-review.csv"), "utf8")
  .split("\n")
  .filter(Boolean)
  .slice(1)
  .map((line) => line.match(/^"((?:[^"]|"")*)"/)?.[1]?.replaceAll('""', '"') || "");
const expectedTitles = resources.map((resource) => resource.title);
if (reviewRows.length !== expectedTitles.length || reviewRows.some((title, index) => title !== expectedTitles[index])) {
  problems.push("data/resource-review.csv is out of sync with data/resources.js.");
}

for (const resource of resources) {
  if (resource.languages !== undefined) {
    if (!Array.isArray(resource.languages) || !resource.languages.length) {
      problems.push(`${resource.title}: languages must be a non-empty array.`);
    } else {
      if (resource.languages.some((code) => !["en", "es"].includes(code))) {
        problems.push(`${resource.title}: languages must contain only "en" and "es".`);
      }
      if (new Set(resource.languages).size !== resource.languages.length) {
        problems.push(`${resource.title}: languages contains duplicates.`);
      }
    }
    coverage.languages += 1;
  } else if (requireAll) {
    problems.push(`${resource.title}: missing languages.`);
  }

  if (resource.gradeRange !== undefined) {
    if (typeof resource.gradeRange !== "string" || !resource.gradeRange.trim()) {
      problems.push(`${resource.title}: gradeRange must be a non-empty string.`);
    }
    coverage.gradeRange += 1;
  } else if (requireAll) {
    problems.push(`${resource.title}: missing gradeRange.`);
  }

  if (resource.description !== undefined) {
    const description = resource.description;
    if (!description || typeof description.en !== "string" || !description.en.trim() ||
        typeof description.es !== "string" || !description.es.trim()) {
      problems.push(`${resource.title}: description needs non-empty en/es copy.`);
    }
    coverage.description += 1;
  } else if (requireAll) {
    problems.push(`${resource.title}: missing description.`);
  }
}

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}

const total = resources.length;
console.log(
  `Resource metadata: ${coverage.languages}/${total} languages, ` +
    `${coverage.gradeRange}/${total} grades, ${coverage.description}/${total} descriptions.`
);
if (requireAll && Object.values(coverage).some((value) => value !== total)) {
  console.error("Metadata review is incomplete. Fill data/resource-review.csv before using --require.");
  process.exit(1);
}
