import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function collectConsoleErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("home page loads with complete metadata and no broken images", async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle(/Bobber the Water Safety Dog/);
  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator(".resource-card")).toHaveCount(42);
  await expect(page.locator(".resource-meta")).toHaveCount(42);
  await expect(page.locator(".resource-meta").first()).toHaveText("2 pages · 5.5 MB");
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
  await expect(page.locator('.footer-bottom a[href*="accessibility.html"]')).toHaveAttribute("href", "accessibility.html#espanol");
  expect(page.url()).toContain("lang=es");

  await page.click("#header-language-toggle");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(page.url()).not.toContain("lang=es");
  await expect(page.locator('.footer-bottom a[href*="accessibility.html"]')).toHaveAttribute("href", "accessibility.html");

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

test("theme toggle updates data-theme, theme-color, and persists", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#fffefa");

  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#101c20");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.click("#theme-toggle");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("Bobber rotates tips without changing the hero card height", async ({ page }) => {
  await page.goto("/");
  const bubble = page.locator(".speech-bubble");
  const before = await bubble.textContent();
  const beforeHeight = await page.locator(".hero-feature").evaluate((element) => element.getBoundingClientRect().height);
  await page.evaluate(() => advanceSpeechBubble());
  await expect(bubble).not.toHaveText(before);
  const afterHeight = await page.locator(".hero-feature").evaluate((element) => element.getBoundingClientRect().height);
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThan(0.5);
});

test("the library opens a fast preview and keeps the print PDF for download", async ({ page }) => {
  await page.goto("/");
  await page.locator(".resource-link").first().click();
  await expect(page.locator("#pdf-reader")).toHaveJSProperty("open", true);
  await expect(page.locator("#pdf-reader-download")).toHaveText("Download print PDF");
  await expect(page.locator("#pdf-reader-download")).toHaveAttribute(
    "href",
    /Bobber%20Boating%20Items%20Actitvty%20Sheet\.pdf$/
  );
  await expect(page.locator("#pdf-reader-stage canvas")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#pdf-reader-status")).toHaveText("Page 1 of 2");
  expect(await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("-web.pdf")))).toBe(true);
  await page.click("#pdf-reader-close");
  await expect(page.locator("#pdf-reader")).not.toHaveAttribute("open", "");

  await page.click("#header-language-toggle");
  await page.locator(".resource-link").first().click();
  await expect(page.locator("#pdf-reader-download")).toHaveText("Descargar PDF para imprimir");
  await page.click("#pdf-reader-close");
});

test("every catalog resource has page and size metadata", async ({ page }) => {
  await page.goto("/");
  const missing = await page.evaluate(() =>
    window.BOBBER_RESOURCES.filter((resource) => !window.BOBBER_PDF_META[resource.file]).map((resource) => resource.title)
  );
  expect(missing).toEqual([]);
  const previews = await page.evaluate(() => Object.values(window.BOBBER_PDF_META).filter((entry) => entry.webFile).length);
  expect(previews).toBe(8);
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

for (const pagePath of ["/", "/grown-ups.html"]) {
  for (const theme of ["light", "dark"]) {
    test(`${pagePath} has no axe violations in ${theme}`, async ({ page }) => {
      // Reduced motion keeps the scroll-reveal cards fully painted so axe sees
      // their final colors rather than a mid-transition composite.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(pagePath);
      if (theme === "dark") await page.click("#theme-toggle");
      await page.waitForTimeout(200);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

test("accessibility and privacy page passes axe and reflows at 320px", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/accessibility.html");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, colorScheme).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/accessibility.html");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});
