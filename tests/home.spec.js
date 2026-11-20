import { test, expect } from "@playwright/test";
import { collectConsoleErrors } from "./helpers.js";

test("home page loads with complete metadata and no broken images", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/Bobber the Water Safety Dog/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".resource-card")).toHaveCount(42);
  await expect(page.locator(".resource-meta")).toHaveCount(42);
  await expect(page.locator(".resource-meta").first()).toHaveText("2 pages · 412 KB preview · 5.5 MB print");
  expect(await page.evaluate(() => Object.isFrozen(window.BOBBER_CONTENT))).toBe(true);
  const jsonLd = await page.locator('script[type="application/ld+json"]').evaluate((script) => JSON.parse(script.textContent));
  expect(jsonLd["@graph"].some((node) => node["@type"] === "WebSite")).toBe(true);
  expect(jsonLd["@graph"].some((node) => node["@type"] === "GovernmentOrganization")).toBe(true);
  const broken = await page.locator("img").evaluateAll((images) =>
    images.filter((image) => image.complete && image.naturalWidth === 0).length
  );
  expect(broken).toBe(0);
  expect(errors).toEqual([]);
});

test("Spanish deep links work and the URL follows the language toggle", async ({ page }) => {
  await page.goto("/?lang=es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page).toHaveTitle(/perro de seguridad acuática/i);
  await expect(page.locator(".resource-meta").first()).toContainText("páginas");
  await expect(page.locator(".resource-meta").first()).toContainText("vista previa");
  await expect(page.locator('.footer-bottom a[href*="accessibility.html"]')).toHaveAttribute("href", "accessibility.html#espanol");
  await expect(page.locator("#header-language-toggle")).toHaveAccessibleName("EN Inglés — cambiar toda la página a inglés");
  expect(page.url()).toContain("lang=es");

  await page.click("#header-language-toggle");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(page.url()).not.toContain("lang=es");
  await expect(page.locator('.footer-bottom a[href*="accessibility.html"]')).toHaveAttribute("href", "accessibility.html");
  await expect(page.locator("#header-language-toggle")).toHaveAccessibleName("ES Español — switch the entire page to Spanish");

  await page.click("#header-language-toggle");
  expect(page.url()).toContain("lang=es");

  await page.goto("/grown-ups.html?lang=es");
  await expect(page).toHaveTitle(/Para adultos/i);
  await expect(page.locator("#page-head-title")).toHaveText("Cosas de adultos.");
});

test("a shared Spanish link keeps Spanish across pages", async ({ page }) => {
  await page.goto("/?lang=es");
  await page.click('.site-nav a[href="grown-ups.html"]');
  await expect(page).toHaveTitle(/Para adultos/i);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  expect(page.url()).toContain("lang=es");
});

test("filter buttons keep their plural labels in both languages", async ({ page }) => {
  await page.goto("/");
  const filters = page.locator(".filter-button");
  await expect(filters.nth(1)).toHaveText("Activities");
  await expect(filters.nth(2)).toHaveText("Posters & coloring");
  await expect(filters.nth(3)).toHaveText("Storybooks");

  await page.click("#header-language-toggle");
  await expect(filters.nth(1)).toHaveText("Actividades");
  await expect(filters.nth(2)).toHaveText("Afiches y dibujos");
  await expect(filters.nth(3)).toHaveText("Cuentos");
});

test("Spanish deep links work when browser storage is blocked", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Storage.prototype.getItem = function () { throw new DOMException("blocked", "SecurityError"); };
    Storage.prototype.setItem = function () { throw new DOMException("blocked", "SecurityError"); };
  });
  const page = await context.newPage();
  const errors = collectConsoleErrors(page);
  await page.goto("/?lang=es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("h1")).toContainText("Disfruta");
  expect(errors).toEqual([]);
  await context.close();
});

test("keyboard shortcuts do not fail on pages without a resource search", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/grown-ups.html");
  await page.keyboard.press("/");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  expect(errors).toEqual([]);
});

test("theme toggle updates data-theme, theme-color, and persists", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#fffefa");
  await expect(page.locator("#theme-toggle")).toHaveAccessibleName("Switch to dark mode");

  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#101c20");
  await expect(page.locator("#theme-toggle")).toHaveAccessibleName("Switch to light mode");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Bobber rotates tips without changing the hero card height", async ({ page }) => {
  // Test the narrow layout, where longer Spanish/English tips can wrap.
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto("/");
  const bubble = page.locator(".speech-bubble");
  const before = await bubble.textContent();
  const beforeHeight = await page.locator(".hero-feature").evaluate((element) => element.getBoundingClientRect().height);
  await page.evaluate(() => advanceSpeechBubble());
  await expect(bubble).not.toHaveText(before);
  const afterHeight = await page.locator(".hero-feature").evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThan(0.5);
});

test("no horizontal overflow at phone and desktop widths in both languages", async ({ page }) => {
  for (const width of [320, 360, 768, 1440]) {
    for (const lang of ["en", "es"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${lang}&layout=${width}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${width}px ${lang}`).toBe(0);
    }
  }
});

test("mobile navigation opens directly below the header", async ({ page }) => {
  for (const width of [360, 640, 768, 1024, 1200]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.click("#menu-toggle");
    const geometry = await page.evaluate(() => {
      const header = document.querySelector(".site-header").getBoundingClientRect();
      const nav = document.querySelector("#site-nav").getBoundingClientRect();
      return { headerBottom: header.bottom, navTop: nav.top, display: getComputedStyle(document.querySelector("#site-nav")).display };
    });
    expect(geometry.display, `${width}px menu`).toBe("flex");
    expect(geometry.navTop, `${width}px gap`).toBeLessThanOrEqual(geometry.headerBottom);
    expect(geometry.headerBottom - geometry.navTop, `${width}px overlap`).toBeLessThanOrEqual(4);
  }
});

test("grown-ups page links to the classroom pack and QR poster", async ({ page }) => {
  await page.goto("/grown-ups.html");
  await expect(page.locator('a[href*="Bobber_Classroom_Pack_2026.zip"]')).toBeVisible();
  await expect(page.locator('a[href="poster.html"]')).toBeVisible();
  const response = await page.request.head("http://127.0.0.1:4173/assets/downloads/Bobber_Classroom_Pack_2026.zip");
  expect(response.ok()).toBeTruthy();
});

test("footer report link carries the current page and language", async ({ page }) => {
  await page.goto("/grown-ups.html");
  const link = page.locator("#report-problem");
  let href = new URL(await link.getAttribute("href"));
  expect(href.searchParams.get("title")).toBe("Website problem");
  expect(href.searchParams.get("body")).toContain("http://127.0.0.1:4173/grown-ups.html");
  expect(href.searchParams.get("body")).toContain("What happened:");

  await page.click("#header-language-toggle");
  await expect(link).toContainText("Informar de un problema");
  href = new URL(await link.getAttribute("href"));
  expect(href.searchParams.get("title")).toBe("Problema en el sitio web");
  expect(href.searchParams.get("body")).toContain("Qué ocurrió:");
});

test("unknown paths render the custom not-found page", async ({ page }) => {
  const response = await page.goto("/does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page swam away." })).toBeVisible();
});

