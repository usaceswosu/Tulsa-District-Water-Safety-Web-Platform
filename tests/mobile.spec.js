import { test, expect } from "@playwright/test";

// Runs in the Pixel 7/Chromium and iPhone 13/WebKit projects only.
test("mobile home, navigation, and language controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".resource-card")).toHaveCount(42);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.tap("#menu-toggle");
  await expect(page.locator("#menu-toggle")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#site-nav")).toBeVisible();
  const geometry = await page.evaluate(() => {
    const header = document.querySelector(".site-header").getBoundingClientRect();
    const nav = document.querySelector("#site-nav").getBoundingClientRect();
    return { headerBottom: header.bottom, navTop: nav.top, display: getComputedStyle(document.querySelector("#site-nav")).display };
  });
  expect(geometry.display).toBe("flex");
  expect(geometry.navTop).toBeLessThanOrEqual(geometry.headerBottom);
  expect(geometry.headerBottom - geometry.navTop).toBeLessThanOrEqual(4);

  await page.tap("#header-language-toggle");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("#resource-search")).toHaveAttribute("placeholder", "Buscar actividades, afiches y cuentos…");
});

test("mobile reader opens, navigates, and restores focus", async ({ page }) => {
  await page.goto("/");
  await page.locator(".resource-link").first().tap();
  await expect(page.locator("#pdf-reader")).toHaveJSProperty("open", true);
  await expect(page.locator(".pdf-reader-placeholder")).toBeVisible();

  const canvas = page.locator("#pdf-reader-stage canvas");
  const fallback = page.locator("#pdf-reader-stage iframe");
  await expect(canvas.or(fallback)).toBeVisible({ timeout: 20_000 });
  if (await canvas.isVisible()) {
    await page.fill("#pdf-reader-page-input", "2");
    await page.press("#pdf-reader-page-input", "Enter");
    await expect(page.locator("#pdf-reader-status")).toHaveText("Page 2 of 2");
    await page.tap("#pdf-reader-zoom-in");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("125%");
    await page.tap("#pdf-reader-zoom-reset");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("100%");
  }

  await page.tap("#pdf-reader-close");
  await expect(page.locator("#pdf-reader")).not.toHaveAttribute("open", "");
  await expect(page.locator(".resource-link").first()).toBeFocused();
});

test("mobile offline shell and Spanish headline", async ({ page, context }) => {
  await page.goto("/?mobile-offline=" + Date.now(), { waitUntil: "load" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Big fun");
  await expect(page.locator(".pwa-banner").filter({ hasText: /offline/i })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await context.setOffline(false);
});
