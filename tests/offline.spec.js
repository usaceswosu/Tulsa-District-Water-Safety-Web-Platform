import { test, expect } from "@playwright/test";

test("Save-Data skips the offline shell", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true }
    });
  });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  expect(await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
  await context.close();
});

test("the offline shell loads after installation", async ({ page, context }) => {
  await page.goto("/?offline=" + Date.now(), { waitUntil: "load" });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Bobber/);
  await expect(page.locator("h1")).toContainText("Big fun");
  await expect(page.locator(".resource-card")).toHaveCount(42);
  await expect(page.locator(".pwa-banner").filter({ hasText: /offline/i })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector(".site-header")).position)).toBe("sticky");

  const imageLoaded = await page.evaluate(async () => {
    const image = new Image();
    image.src = "assets/graphics/Bobber_InVest_in_Safety_Poster%26Coloring_th_L7cc.webp";
    document.body.append(image);
    try {
      await image.decode();
      return image.naturalWidth > 0;
    } catch {
      return false;
    }
  });
  expect(imageLoaded).toBe(true);

  await page.goto(`/grown-ups.html?lang=es&offline=${Date.now()}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toHaveText("Cosas de adultos.");
  await expect(page).toHaveTitle(/Para adultos/i);
  expect(page.url()).toContain("lang=es");
  await context.setOffline(false);
});
