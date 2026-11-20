// Validate the home-page content file without a browser. Catches missing
// bilingual strings, broken artwork paths, and malformed quiz answers.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { siteRoot } from "./lib/site-root.mjs";

const sandbox = { window: {} };
runInNewContext(readFileSync(join(siteRoot, "data/content.js"), "utf8"), sandbox, { filename: "data/content.js" });
const content = sandbox.window.BOBBER_CONTENT;
const problems = [];

function checkBilingual(value, label) {
  if (!value || typeof value.en !== "string" || !value.en.trim() || typeof value.es !== "string" || !value.es.trim()) {
    problems.push(`${label} needs non-empty en/es copy.`);
  }
}

function checkImage(value, label) {
  if (!value || !existsSync(join(siteRoot, value))) problems.push(`${label} image is missing: ${value}`);
}

if (!content) {
  console.error("data/content.js did not define window.BOBBER_CONTENT.");
  process.exit(1);
}

if (!Array.isArray(content.tips) || content.tips.length < 4) problems.push("tips should contain at least four bilingual tips.");
else content.tips.forEach((tip, index) => checkBilingual(tip, `tips[${index}]`));

for (const key of ["bare", "jacket", "buddy"]) checkImage(content.looks?.[key], `looks.${key}`);

if (!Array.isArray(content.reactions) || content.reactions.length < 4) problems.push("reactions should contain at least four entries.");
else content.reactions.forEach((reaction, index) => checkBilingual(reaction.say, `reactions[${index}].say`));

const pals = content.palCards || {};
if (Object.keys(pals).length < 5) problems.push("palCards should contain all five friends.");
for (const [name, card] of Object.entries(pals)) {
  checkImage(card.art, `palCards.${name}.art`);
  checkBilingual(card.rule, `palCards.${name}.rule`);
  if (!Number.isInteger(card.page) || card.page < 1) problems.push(`palCards.${name}.page must be a positive page number.`);
}

if (!Array.isArray(content.gamePool) || content.gamePool.length < 4) problems.push("gamePool should contain at least four questions.");
else {
  content.gamePool.forEach((round, index) => {
    checkImage(round.art, `gamePool[${index}].art`);
    checkBilingual(round.alt, `gamePool[${index}].alt`);
    checkBilingual(round.question, `gamePool[${index}].question`);
    if (!Array.isArray(round.options) || round.options.length < 2) {
      problems.push(`gamePool[${index}] needs at least two options.`);
      return;
    }
    round.options.forEach((option, optionIndex) => checkBilingual(option, `gamePool[${index}].options[${optionIndex}]`));
    if (round.options.filter((option) => option?.correct).length !== 1) {
      problems.push(`gamePool[${index}] must have exactly one correct option.`);
    }
  });
}

if (problems.length) {
  console.error(problems.map((problem) => ` - ${problem}`).join("\n"));
  process.exit(1);
}
console.log(`Content check passed: ${content.tips.length} tips, ${Object.keys(pals).length} pal cards, ${content.gamePool.length} quiz questions.`);
