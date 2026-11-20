// Post-deploy smoke test against the public GitHub Pages URL.
// Usage: npm run check:live
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { siteRoot } from "./lib/site-root.mjs";
import { siteUrl } from "./lib/site-config.mjs";

// Optional first argument lets maintainers smoke-test a local/staging origin.
// Canonical metadata is still checked against site.config.json.
const target = (process.argv[2] || siteUrl).replace(/\/+$/, "");
const home = `${target}/index.html`;
const expectedVersion = readFileSync(join(siteRoot, "index.html"), "utf8").match(/main\.js\?v=([0-9a-z]+)/)?.[1];
if (!expectedVersion) {
  console.error("Live smoke failed: could not read the expected asset version from index.html.");
  process.exit(1);
}
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
const page = await context.newPage();
const errors = [];
const previewRequests = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
page.on("request", (request) => {
  if (request.url().includes("-web.pdf")) previewRequests.push(request.url());
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

try {
  let state;
  // Pages can take a little time to propagate after the deployment workflow.
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    await page.goto(`${home}?live-smoke=${Date.now()}`, { waitUntil: "load", timeout: 60_000 });
    await page.waitForSelector(".resource-card", { timeout: 20_000 });
    state = await page.evaluate(() => {
      const script = [...document.scripts].find((item) => item.src.includes("main.js"));
      return {
        version: script ? new URL(script.src).searchParams.get("v") : "",
        cards: document.querySelectorAll(".resource-card").length,
        frozen: Object.isFrozen(window.BOBBER_CONTENT),
        firstMeta: document.querySelector(".resource-meta")?.textContent || "",
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) => {
          try {
            return JSON.parse(script.textContent);
          } catch {
            return null;
          }
        })
      };
    });
    if (state.version === expectedVersion && state.firstMeta.includes("preview") && state.firstMeta.includes("print")) break;
    if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  assert(state.version === expectedVersion, `Live version ${state.version} does not match repository version ${expectedVersion}.`);
  assert(state.cards === 42, `Expected 42 resource cards, found ${state.cards}.`);
  assert(state.frozen, "Home-page content is not frozen.");
  assert(state.firstMeta.includes("preview") && state.firstMeta.includes("print"), `Unexpected card metadata: ${state.firstMeta}`);
  assert(state.canonical.startsWith(siteUrl), `Unexpected canonical URL: ${state.canonical}`);
  const jsonLdDocuments = state.jsonLd || [];
  assert(jsonLdDocuments.every(Boolean), "A live JSON-LD block is invalid.");
  const graph = jsonLdDocuments.flatMap((document) =>
    Array.isArray(document?.["@graph"]) ? document["@graph"] : [document]
  );
  const websiteNode = graph.find((node) => node["@type"] === "WebSite");
  const organizationNode = graph.find((node) => node["@type"] === "GovernmentOrganization");
  const libraryNode = graph.find((node) => node["@type"] === "ItemList");
  assert(websiteNode?.url === `${siteUrl}/`, "JSON-LD WebSite URL is missing or stale.");
  assert(organizationNode?.["@id"]?.endsWith("#organization"), "JSON-LD organization node is missing.");
  assert(libraryNode?.numberOfItems === 42, "JSON-LD library ItemList is missing items.");
  assert(libraryNode?.itemListElement?.length === 42, "JSON-LD library ItemList has the wrong item count.");
  assert(libraryNode.itemListElement.every((entry) => entry.item?.url?.startsWith(`${siteUrl}/assets/`)), "JSON-LD library item URL is stale.");

  const versionDate = `${expectedVersion.slice(0, 4)}-${expectedVersion.slice(4, 6)}-${expectedVersion.slice(6, 8)}`;
  for (const path of ["/accessibility.html", "/poster.html", "/manifest.webmanifest", "/assets/qr/bobber-site.svg", "/assets/qr/bobber-site-es.svg", "/assets/downloads/Bobber_Classroom_Pack_2026.zip"]) {
    const response = await context.request.head(`${target}${path}`, { failOnStatusCode: false });
    assert(response.ok(), `Critical URL failed (${response.status()}): ${path}`);
  }
  const sitemap = await context.request.get(`${target}/sitemap.xml`, { failOnStatusCode: false });
  const sitemapText = await sitemap.text();
  assert(sitemap.ok() && sitemapText.includes(`<loc>${siteUrl}/</loc>`), "Sitemap is missing or has the wrong home URL.");
  assert(sitemapText.includes(`<lastmod>${versionDate}</lastmod>`), "Sitemap lastmod does not match the asset version.");
  const robots = await context.request.get(`${target}/robots.txt`, { failOnStatusCode: false });
  assert(robots.ok() && (await robots.text()).includes(`Sitemap: ${siteUrl}/sitemap.xml`), "Robots sitemap reference is missing or stale.");

  await page.click('[data-filter="activity"]');
  const visible = await page.locator(".resource-card:visible").count();
  assert(visible === 14, `Expected 14 activity cards, found ${visible}.`);

  const previewRequest = page.waitForRequest((request) => request.url().includes("-web.pdf"), { timeout: 20_000 }).catch(() => null);
  await page.locator(".resource-link").first().click();
  const canvas = page.locator("#pdf-reader-stage canvas");
  const fallback = page.locator("#pdf-reader-stage iframe");
  await canvas.or(fallback).waitFor({ state: "visible", timeout: 30_000 });
  await previewRequest;
  assert(previewRequests.some((url) => url.includes(`?v=${state.version}`)), "Preview URL is not versioned.");
  await page.click("#pdf-reader-close");

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  const pwa = await page.evaluate(async () => {
    const keys = await caches.keys();
    const shell = keys.find((key) => key.startsWith("bobber-shell-"));
    const cache = shell ? await caches.open(shell) : null;
    return { keys, shellCount: cache ? (await cache.keys()).length : 0 };
  });
  assert(pwa.keys.some((key) => key === `bobber-shell-${state.version}`), "Versioned shell cache is missing.");
  assert(pwa.shellCount >= 80, `Shell cache looks incomplete: ${pwa.shellCount} entries.`);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
  assert((await page.locator("h1").textContent())?.includes("Big fun"), "Offline home page did not load.");
  await page.goto(`${target}/grown-ups.html?lang=es`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert((await page.locator("h1").textContent()) === "Cosas de adultos.", "Offline Spanish grown-ups page did not load.");
  await context.setOffline(false);

  assert(errors.length === 0, `Browser errors: ${errors.join(" | ")}`);
  console.log(
    `Live smoke passed: version ${state.version}, 42 cards, reader preview, ` +
      `${pwa.shellCount} shell entries, offline navigation.`
  );
} catch (error) {
  console.error(`Live smoke failed: ${error.message}`);
  if (errors.length) console.error(errors.map((message) => ` - ${message}`).join("\n"));
  process.exitCode = 1;
} finally {
  await browser.close();
}
