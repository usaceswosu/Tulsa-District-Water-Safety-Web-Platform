// Verify that both pages, the precache list, and the classroom pack use one
// asset version. Run after changing any versioned file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";

const pages = ["index.html", "grown-ups.html"];
const required = {
  "index.html": [
    "styles.css",
    "scripts/pdf-reader.js",
    "scripts/main.js",
    "data/resources.js",
    "data/pdf-meta.js",
    "data/translations.js",
    "data/content.js"
  ],
  "grown-ups.html": [
    "styles.css",
    "scripts/pdf-reader.js",
    "scripts/main.js",
    "data/resources.js",
    "data/translations.js",
    "assets/downloads/Bobber_Classroom_Pack_2026.zip"
  ]
};
const problems = [];
const versionsByPage = {};

for (const page of pages) {
  const html = readFileSync(join(siteRoot, page), "utf8");
  const localRefs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((ref) => !/^(?:https?:|\/\/|data:|#)/.test(ref));
  const versions = new Set(localRefs.map((ref) => ref.match(/[?&]v=([0-9a-z]+)/)?.[1]).filter(Boolean));
  versionsByPage[page] = versions;
  if (versions.size !== 1) {
    problems.push(`${page} should use exactly one ?v= value; found ${[...versions].join(", ") || "none"}.`);
  }
  for (const asset of required[page]) {
    if (!html.includes(`${asset}?v=`)) {
      problems.push(`${page} is missing a versioned reference to ${asset}.`);
    }
  }
  for (const ref of localRefs) {
    if (/\.(?:css|js|mjs)(?:\?|$)/.test(ref) && !ref.includes("?v=")) {
      problems.push(`${page} has an unversioned asset reference: ${ref}.`);
    }
  }
  for (const match of html.matchAll(/(?:src|href)="(https?:[^"]*[?&]v=\d{8}[a-z])/g)) {
    problems.push(`${page} has an external URL that looks like it was version-bumped: ${match[1]}.`);
  }
}

const allVersions = new Set([...versionsByPage["index.html"], ...versionsByPage["grown-ups.html"]]);
if (allVersions.size > 1) {
  problems.push(`Pages disagree on the asset version: ${[...allVersions].join(", ")}.`);
}
const version = allVersions.size === 1 ? [...allVersions][0] : null;
if (version && !/^\d{8}[a-z]$/.test(version)) {
  problems.push(`Asset version "${version}" should look like YYYYMMDDx.`);
}

if (version) {
  const precache = JSON.parse(readFileSync(join(siteRoot, "precache.json"), "utf8"));
  const precacheVersions = new Set(precache.map((url) => url.match(/\?v=([0-9a-z]+)/)?.[1]).filter(Boolean));
  if (precacheVersions.size !== 1 || !precacheVersions.has(version)) {
    problems.push(`precache.json should use only ?v=${version}; found ${[...precacheVersions].join(", ") || "none"}.`);
  }
  for (const asset of ["styles.css", "scripts/main.js", "scripts/pdf-reader.js", "data/content.js"]) {
    if (!precache.includes(`./${asset}?v=${version}`)) {
      problems.push(`precache.json is missing ./${asset}?v=${version}.`);
    }
  }
}

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Asset version ${version} is consistent across pages and the precache list.`);
