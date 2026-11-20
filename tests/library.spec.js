import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("the library opens a fast preview and keeps the print PDF for download", async ({ page }) => {
  await page.goto("/");
  await page.route("**/*-web.pdf*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await route.continue();
    } catch {
      // Firefox may cancel and retry a range request after the route was handled.
    }
  });
  const previewRequest = page.waitForRequest((request) => request.url().includes("-web.pdf"), { timeout: 15_000 });
  await page.locator(".resource-link").first().click();
  await expect(page.locator("#pdf-reader")).toHaveJSProperty("open", true);
  await expect(page.locator(".pdf-reader-placeholder")).toBeVisible();
  await expect(page.locator("#pdf-reader-print-page")).toBeDisabled();
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
  await page.unroute("**/*-web.pdf*");
  if (await canvas.isVisible()) {
    await expect(page.locator("#pdf-reader-status")).toHaveText("Page 1 of 2");
    await expect(page.locator("#pdf-reader-print-page")).toBeEnabled();
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("100%");
    await page.click("#pdf-reader-zoom-in");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("125%");
    await page.fill("#pdf-reader-page-input", "2");
    await page.press("#pdf-reader-page-input", "Enter");
    await expect(page.locator("#pdf-reader-status")).toHaveText("Page 2 of 2");
    await page.locator("#pdf-reader-page-input").focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(150);
    await expect(page.locator("#pdf-reader-status")).toHaveText("Page 2 of 2");
    await page.click("#pdf-reader-zoom-reset");
    await expect(page.locator("#pdf-reader-zoom-value")).toHaveText("100%");
    await expect(page.locator("#pdf-reader-print-full")).toHaveText("Print full PDF");
    await expect(page.locator("#pdf-reader-print-full")).toHaveAttribute(
      "href",
      /Bobber%20Boating%20Items%20Actitvty%20Sheet\.pdf$/
    );
    expect(await page.locator("#pdf-reader-print-full").getAttribute("download")).toBeNull();
    await expect(page.locator("#pdf-reader-print-page")).toBeVisible();
    await page.evaluate(() => {
      window.print = () => {
        window.__printSnapshot = {
          class: document.body.classList.contains("printing-reader-page"),
          canvas: !!document.querySelector("#pdf-print-page canvas")
        };
      };
    });
    await page.click("#pdf-reader-print-page");
    await expect.poll(async () => page.evaluate(() => window.__printSnapshot)).toEqual({ class: true, canvas: true });
    // The print page must survive until the browser reports that printing ended.
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => document.body.classList.contains("printing-reader-page"))).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect.poll(async () => page.evaluate(() => document.body.classList.contains("printing-reader-page"))).toBe(false);
    await expect(page.locator("#pdf-print-page canvas")).toHaveCount(0);
  } else {
    await expect(page.locator("#pdf-reader-status")).toContainText("Showing this PDF");
  }
  expect((await previewRequest).url()).toMatch(/-web\.pdf\?v=[0-9a-z]+$/);
  await page.click("#pdf-reader-close");
  await expect(page.locator("#pdf-reader")).not.toHaveAttribute("open", "");

  await page.click("#header-language-toggle");
  await page.locator(".resource-link").first().click();
  await expect(page.locator("#pdf-reader-download")).toHaveText("Descargar PDF para imprimir");
  await expect(page.locator("#pdf-reader-print-full")).toHaveText("Imprimir PDF completo");
  await expect(page.locator("#pdf-reader-print-full")).toHaveAttribute(
    "aria-label",
    "Imprimir PDF completo (se abre en una pestaña nueva)"
  );
  await page.click("#pdf-reader-close");
});

test.describe("reader recovery", () => {
  test.use({ serviceWorkers: "block" });

  test("a failed engine prefetch does not block later PDFs", async ({ page }) => {
    let failedOnce = false;
    await page.route("**/vendor/pdfjs/build/pdf.min.mjs*", async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        await route.abort();
      } else {
        await route.continue();
      }
    });
    const moduleFailed = page.waitForEvent("requestfailed", {
      predicate: (request) => request.url().includes("pdf.min.mjs"),
      timeout: 15_000
    });
    await page.goto("/");
    await page.locator(".library-section").scrollIntoViewIfNeeded();
    await moduleFailed;
    await page.waitForTimeout(150);

    const canvas = page.locator("#pdf-reader-stage canvas");
    const fallback = page.locator("#pdf-reader-stage iframe");
    await page.locator(".resource-link").first().click();
    await expect(canvas.or(fallback)).toBeVisible({ timeout: 20_000 });
    test.skip(!(await canvas.isVisible()), "Browser PDF viewer fallback was used.");
    await page.click("#pdf-reader-close");
    await page.locator(".resource-link").nth(1).click();
    await expect(canvas).toBeVisible({ timeout: 20_000 });
  });

  test("closing and reopening immediately keeps the reader usable", async ({ page }) => {
    await page.goto("/");
    await page.locator(".resource-link").first().click();
    await expect(page.locator(".pdf-reader-placeholder")).toBeVisible();
    await page.evaluate(() => {
      document.querySelector("#pdf-reader").close();
      document.querySelector(".resource-link").click();
    });
    await expect(page.locator("#pdf-reader")).toHaveJSProperty("open", true);
    await expect(page.locator("#pdf-reader-stage canvas").or(page.locator("#pdf-reader-stage iframe")))
      .toBeVisible({ timeout: 20_000 });
    await expect(page.locator("#pdf-reader-title")).toHaveText("Bobber Boating Items");
  });
});

test("card details and their links stay in the selected language", async ({ page }) => {
  await page.goto("/?lang=es");
  const firstSafetyCard = page.locator(".safety-card").first();
  await firstSafetyCard.locator(".card-open").click();
  await expect(firstSafetyCard.locator(".card-open")).toHaveAttribute(
    "aria-label",
    "Abrir detalles: Usa tu chaleco salvavidas"
  );
  await expect(page.locator("#info-title")).toHaveText("Usa tu chaleco salvavidas");
  await page.click("#info-close");

  await page.locator(".friends-row li").filter({ hasText: "Corkey" }).locator(".card-open").click();
  await expect(page.locator("#info-link")).toContainText("Abrir la tarjeta para imprimir");
  await expect(page.locator("#info-link")).toHaveAttribute(
    "aria-label",
    "Abrir la tarjeta para imprimir (se abre en una pestaña nueva)"
  );
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

test("library search and filters reuse the existing cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".resource-card")).toHaveCount(42);
  await page.evaluate(() => { window.__firstResourceCard = document.querySelector(".resource-card"); });

  await page.click('[data-filter="activity"]');
  await expect(page.locator(".resource-card:visible")).toHaveCount(14);
  await expect(page.locator(".resource-card")).toHaveCount(42);
  expect(await page.evaluate(() => window.__firstResourceCard === document.querySelector(".resource-card"))).toBe(true);

  await page.fill("#resource-search", "maze");
  await expect(page.locator(".resource-card:visible")).toHaveCount(1);
  await expect(page.locator(".resource-card:visible")).toContainText("Bobber Maze");
  await page.fill("#resource-search", "");
  await expect(page.locator(".resource-card:visible")).toHaveCount(14);

  await page.click('[data-filter="all"]');
  await expect(page.locator(".resource-card:visible")).toHaveCount(42);
});

test("every catalog resource has page and size metadata", async ({ page }) => {
  await page.goto("/");
  const missing = await page.evaluate(() =>
    window.BOBBER_RESOURCES.filter((resource) => !window.BOBBER_PDF_META[resource.file]).map((resource) => resource.title)
  );
  expect(missing).toEqual([]);
  const previews = await page.evaluate(() => Object.values(window.BOBBER_PDF_META).filter((entry) => entry.webFile).length);
  expect(previews).toBe(12);
});

test("the reader engine warms when the library approaches", async ({ page }) => {
  const moduleRequest = page.waitForRequest(/pdf\.min\.mjs/, { timeout: 15_000 });
  const workerRequest = page.waitForRequest(/pdf\.worker\.min\.mjs/, { timeout: 15_000 });
  await page.goto("/");
  await page.locator(".library-section").scrollIntoViewIfNeeded();
  await moduleRequest;
  await workerRequest;
});

