import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const pagePath of ["/", "/grown-ups.html"]) {
  for (const theme of ["light", "dark"]) {
    test(`${pagePath} has no axe violations in ${theme}`, async ({ page }) => {
      // Reduced motion keeps the scroll-reveal cards fully painted so axe sees
      // their final colors rather than a mid-transition composite.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(pagePath);
      if (pagePath === "/") await expect(page.locator(".resource-card")).toHaveCount(42);
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

test("printing from dark mode stays light and reveals off-screen cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".resource-card")).toHaveCount(42);
  await page.click("#theme-toggle");
  await page.emulateMedia({ media: "print" });
  const home = await page.evaluate(() => {
    const style = (selector) => {
      const element = document.querySelector(selector);
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, color: computed.color, opacity: computed.opacity };
    };
    return {
      safetyCard: style(".safety-card"),
      safetyCopy: style(".safety-card p"),
      sectionCopy: style(".section-heading p"),
      resourceCard: style(".resource-card"),
      arCard: style(".ar-card")
    };
  });
  expect(home.safetyCard.background).toBe("rgb(255, 255, 255)");
  expect(home.safetyCopy.color).toBe("rgb(0, 0, 0)");
  expect(home.sectionCopy.color).toBe("rgb(0, 0, 0)");
  expect(home.resourceCard.background).toBe("rgb(255, 255, 255)");
  expect(home.arCard.opacity).toBe("1");

  await page.emulateMedia({ media: "screen" });
  await page.goto("/accessibility.html");
  await page.emulateMedia({ media: "print" });
  const accessiblePage = await page.evaluate(() => {
    const pageStyle = getComputedStyle(document.querySelector(".page"));
    return {
      background: pageStyle.backgroundColor,
      color: pageStyle.color,
      note: getComputedStyle(document.querySelector(".note")).backgroundColor
    };
  });
  expect(accessiblePage.background).toBe("rgb(255, 255, 255)");
  expect(accessiblePage.color).toBe("rgb(22, 56, 61)");
  expect(accessiblePage.note).toBe("rgb(242, 248, 245)");
});

test("key pages remain usable with forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  for (const path of ["/", "/grown-ups.html"]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
});

