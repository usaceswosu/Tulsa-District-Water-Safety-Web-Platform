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

test("the library opens a fast preview and keeps the print PDF for download", async ({ page }) => {
  await page.goto("/");
  const previewRequest = page.waitForRequest((request) => request.url().includes("-web.pdf"), { timeout: 15_000 });
  await page.locator(".resource-link").first().click();
  await expect(page.locator("#pdf-reader")).toHaveJSProperty("open", true);
  await expect(page.locator("#pdf-reader-download")).toHaveText("Download print PDF");
  await expect(page.locator("#pdf-reader-download")).toHaveAttribute(
    "href",
    /Bobber%20Boating%20Items%20Actitvty%20Sheet\.pdf$/
  );
  // The canvas reader is preferred, but the watchdog may hand off to the
  // browser viewer on a slow CI runner. Both still use the lightweight preview.
  const canvas = page.locator("#pdf-reader-stage canvas");
  const fallback = page.locator("#pdf-reader-stage iframe");
  await expect(canvas.or(fallback)).toBeVisible({ timeout: 15_000 });
  if (await canvas.isVisible()) {
    await expect(page.locator("#pdf-reader-status")).toHaveText("Page 1 of 2");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("100%");
    await page.click("#pdf-reader-zoom-in");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("125%");
    await page.fill("#pdf-reader-page-input", "2");
    await page.press("#pdf-reader-page-input", "Enter");
    await expect(page.locator("#pdf-reader-status")).toHaveText("Page 2 of 2");
    await page.click("#pdf-reader-zoom-reset");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("100%");
  } else {
    await expect(page.locator("#pdf-reader-status")).toContainText("Showing this PDF");
  }
  expect(await previewRequest).not.toBeNull();
  await page.click("#pdf-reader-close");
  await expect(page.locator("#pdf-reader")).not.toHaveAttribute("open", "");

  await page.click("#header-language-toggle");
  await page.locator(".resource-link").first().click();
  await expect(page.locator("#pdf-reader-download")).toHaveText("Descargar PDF para imprimir");
  await page.click("#pdf-reader-close");
});

test("quiz review and the Safety Hero certificate work", async ({ page }) => {
  await page.goto("/");
  await page.locator("#game").scrollIntoViewIfNeeded();
  for (let index = 0; index < 4; index += 1) {
    await page.locator(".game-option").first().click();
    await page.locator("#game-next").click();
  }
  await expect(page.locator(".game-score")).toContainText("of 4");
  await expect(page.locator(".game-review-item")).toHaveCount(4);
  await expect(page.locator("#game-certificate")).toBeVisible();
  await page.click("#game-certificate");
  await expect(page.locator("#certificate-dialog")).toHaveJSProperty("open", true);
  await page.fill("#certificate-name", "Ada");
  await expect(page.locator("#certificate-preview-name")).toHaveText("Ada");
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click("#certificate-print");
  expect(await page.evaluate(() => window.__printed)).toBe(true);
  await expect(page.locator("#certificate-print-name")).toHaveText("Ada");
  expect(await page.evaluate(() => document.body.classList.contains("printing-certificate"))).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  expect(await page.evaluate(() => document.body.classList.contains("printing-certificate"))).toBe(false);
  await page.click("#certificate-close");
});

test("reader outline TOC navigates the long resource guide", async ({ page }) => {
  await page.goto("/grown-ups.html");
  await page.getByRole("link", { name: /Water Safety Resource Guide/i }).click();
  const canvas = page.locator("#pdf-reader-stage canvas");
  const fallback = page.locator("#pdf-reader-stage iframe");
  await expect(canvas.or(fallback)).toBeVisible({ timeout: 20_000 });
  test.skip(!(await canvas.isVisible()), "Browser PDF viewer fallback was used in this environment.");
  await expect(page.locator("#pdf-reader-toc-toggle")).toBeVisible();
  await page.click("#pdf-reader-toc-toggle");
  await expect(page.locator("#pdf-reader-toc")).toBeVisible();
  const links = page.locator(".pdf-reader-toc-link");
  expect(await links.count()).toBeGreaterThan(3);
  await links.last().click();
  await expect(page.locator("#pdf-reader-page-input")).not.toHaveValue("1");
  const results = await new AxeBuilder({ page }).include("#pdf-reader").analyze();
  expect(results.violations).toEqual([]);
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

test("QR poster page passes axe, reflows, and triggers print", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const colorScheme of ["light", "dark"]) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/poster.html");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, colorScheme).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/poster.html");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.click("#poster-print");
  expect(await page.evaluate(() => window.__printed)).toBe(true);
});

test("grown-ups page links to the classroom pack and QR poster", async ({ page }) => {
  await page.goto("/grown-ups.html");
  await expect(page.locator('a[href*="Bobber_Classroom_Pack_2026.zip"]')).toBeVisible();
  await expect(page.locator('a[href="poster.html"]')).toBeVisible();
  const response = await page.request.head("http://127.0.0.1:4173/assets/downloads/Bobber_Classroom_Pack_2026.zip");
  expect(response.ok()).toBeTruthy();
});
