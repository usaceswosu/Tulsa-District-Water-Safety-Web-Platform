// Catch empty rules and exact duplicate CSS that creep in across style passes.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import postcss from "postcss";
import { siteRoot } from "./lib/site-root.mjs";

const root = siteRoot;
const file = join(root, "styles.css");
const css = readFileSync(file, "utf8");
const problems = [];
const tree = postcss.parse(css, { from: file });

function context(node) {
  const parts = [];
  let parent = node.parent;
  while (parent && parent.type !== "root") {
    if (parent.type === "atrule") parts.unshift(`@${parent.name} ${parent.params}`);
    else if (parent.type === "rule") parts.unshift(parent.selector);
    parent = parent.parent;
  }
  return parts.join(" > ");
}

tree.walkRules((rule) => {
  const line = rule.source?.start?.line || "?";
  if (!rule.nodes || rule.nodes.length === 0) {
    problems.push(`Empty rule at line ${line}: ${rule.selector}`);
  }
  const declarations = new Set();
  rule.walkDecls((decl) => {
    const key = `${decl.prop}:${decl.value}`;
    if (declarations.has(key)) problems.push(`Duplicate declaration at line ${decl.source?.start?.line || line}: ${decl.prop}: ${decl.value}`);
    declarations.add(key);
  });
});

tree.walkAtRules((atRule) => {
  if (!atRule.nodes || atRule.nodes.length === 0) {
    problems.push(`Empty at-rule at line ${atRule.source?.start?.line || "?"}: @${atRule.name} ${atRule.params}`);
  }
});

const seen = new Map();
tree.walkRules((rule) => {
  if (!rule.nodes || !rule.nodes.length) return;
  const key = `${context(rule)}|${rule.selector}|${rule.nodes.map((node) => node.toString()).join(";")}`;
  const line = rule.source?.start?.line || "?";
  if (seen.has(key)) problems.push(`Duplicate rule at line ${line} (first at ${seen.get(key)}): ${rule.selector}`);
  else seen.set(key, line);
});

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`CSS check passed: ${tree.nodes.length} top-level nodes, no empty or exact duplicate rules.`);
