// Keep the shared header and footer in sync without changing the static output.
// Run `npm run update:partials` after editing partials/header.html or partials/footer.html.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const checkOnly = process.argv.includes("--check");
const headerTemplate = readFileSync(join(root, "partials/header.html"), "utf8");
const footerTemplate = readFileSync(join(root, "partials/footer.html"), "utf8");
const readerTemplate = readFileSync(join(root, "partials/pdf-reader.html"), "utf8");

const pages = {
  "index.html": {
    home: "#top",
    nav: [
      ["#meet-bobber", "Meet Bobber"],
      ["#safety", "Stay safe"],
      ["#videos", "Watch"],
      ["#resources", "Free resources"],
      ["grown-ups.html", "For grown-ups"],
      ["#resources", "Explore the library", { cta: true }]
    ],
    explore: [
      ["#safety", "Water safety basics"],
      ["#videos", "Bobber cartoons"],
      ["#resources", "Printable resources"],
      ["#ar", "Try the volunteer outfit in AR"],
      ["grown-ups.html", "For grown-ups"]
    ]
  },
  "grown-ups.html": {
    home: "index.html",
    nav: [
      ["index.html#meet-bobber", "Meet Bobber"],
      ["index.html#safety", "Stay safe"],
      ["index.html#videos", "Watch"],
      ["index.html#resources", "Free resources"],
      ["grown-ups.html", "For grown-ups", { current: true }],
      ["index.html", "Back to Bobber", { cta: true }]
    ],
    explore: [
      ["index.html#safety", "Water safety basics"],
      ["index.html#resources", "Printable resources"],
      ["index.html#videos", "Bobber cartoons"],
      ["index.html#ar", "Try the volunteer outfit in AR"],
      ["grown-ups.html#visit", "Plan a lake visit"],
      ["grown-ups.html#educators", "Educator materials"]
    ]
  }
};

function navLink([href, label, options = {}]) {
  const current = options.current ? ' aria-current="page"' : "";
  const cta = options.cta ? ' class="nav-cta"' : "";
  const arrow = options.cta ? ' <span aria-hidden="true">↗</span>' : "";
  return `      <a href="${href}"${current}${cta}>${label}${arrow}</a>`;
}

function exploreLink([href, label]) {
  return `      <a href="${href}">${label}</a>`;
}

function indent(text, spaces = 2) {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((line) => (line ? pad + line : line)).join("\n");
}

function render(html, data) {
  if (
    !html.includes("<!-- partial:header:start -->") ||
    !html.includes("<!-- partial:footer:start -->") ||
    !html.includes("<!-- partial:pdf-reader:start -->")
  ) {
    throw new Error("Missing partial markers.");
  }
  const header = indent(
    headerTemplate
      .replaceAll("{{HOME}}", data.home)
      .replace("{{NAV_LINKS}}", data.nav.map(navLink).join("\n"))
  ).trimEnd();
  const footer = indent(
    footerTemplate
      .replaceAll("{{HOME}}", data.home)
      .replace("{{EXPLORE_LINKS}}", data.explore.map(exploreLink).join("\n"))
  ).trimEnd();
  const reader = indent(readerTemplate).trimEnd();
  return html
    .replace(/(<!-- partial:header:start -->)[\s\S]*?(<!-- partial:header:end -->)/, `$1\n${header}\n  $2`)
    .replace(/(<!-- partial:footer:start -->)[\s\S]*?(<!-- partial:footer:end -->)/, `$1\n${footer}\n  $2`)
    .replace(/(<!-- partial:pdf-reader:start -->)[\s\S]*?(<!-- partial:pdf-reader:end -->)/, `$1\n${reader}\n  $2`);
}

let changed = false;
for (const [file, data] of Object.entries(pages)) {
  const path = join(root, file);
  const before = readFileSync(path, "utf8");
  const after = render(before, data);
  if (before !== after) {
    changed = true;
    if (checkOnly) console.error(`${file} is not in sync with partials/. Run npm run update:partials.`);
    else writeFileSync(path, after);
  }
}

if (checkOnly && changed) process.exit(1);
if (!checkOnly) console.log(changed ? "Updated index.html and grown-ups.html from partials." : "Partial output is already current.");
