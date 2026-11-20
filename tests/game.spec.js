import { test, expect } from "@playwright/test";

test("quiz review and the Safety Hero certificate work", async ({ page }) => {
  await page.goto("/");
  await page.locator("#game").scrollIntoViewIfNeeded();
  for (let index = 0; index < 4; index += 1) {
    await page.locator(".game-option").first().click();
    await page.locator("#game-next").click();
  }
  await expect(page.locator(".game-score")).toContainText("of 4");
  await expect(page.locator(".game-review-item")).toHaveCount(4);
  await expect(page.locator("#game-result")).toBeFocused();
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

