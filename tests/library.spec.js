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
  await expect(page.locator("html")).toHaveClass(/reader-open/);
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
    await expect(page.locator("#pdf-reader-stage")).toHaveClass(/is-fallback/);
  }
  expect((await previewRequest).url()).toMatch(/-web\.pdf\?v=[0-9a-z]+$/);
  await page.click("#pdf-reader-close");
  await expect(page.locator("#pdf-reader")).not.toHaveAttribute("open", "");
  await expect(page.locator("html")).not.toHaveClass(/reader-open/);

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
  await expect(page.locator("#info-copy")).toContainText("Guardia Costera");
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

test("library search matches category names and unaccented Spanish", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".resource-card")).toHaveCount(42);

  await page.fill("#resource-search", "coloring");
  await expect(page.locator(".resource-card:visible")).toHaveCount(23);

  await page.fill("#resource-search", "cuento");
  await expect(page.locator(".resource-card:visible")).toHaveCount(5);

  await page.fill("#resource-search", "accion");
  await expect(page.locator(".resource-card:visible")).toHaveCount(2);
  await expect(page.locator("#results-message")).toHaveText("2 resources matching “accion”");

  await page.fill("#resource-search", "poster");
  await expect(page.locator(".resource-card:visible")).toHaveCount(23);

  await page.fill("#resource-search", "life-vest");
  await expect(page.locator(".resource-card:visible")).toHaveCount(6);

  await page.fill("#resource-search", "pfd");
  await expect(page.locator(".resource-card:visible")).toHaveCount(6);

  await page.fill("#resource-search", "worksheet");
  await expect(page.locator(".resource-card:visible")).toHaveCount(14);

  await page.fill("#resource-search", "colouring");
  await expect(page.locator(".resource-card:visible")).toHaveCount(23);
});

test("zero results offer category shortcuts", async ({ page }) => {
  await page.goto("/");
  await page.fill("#resource-search", "zzzz-not-a-resource");
  await expect(page.locator("#empty-state")).toBeVisible();
  await expect(page.locator(".empty-suggestion")).toHaveCount(3);

  await page.locator(".empty-suggestion").filter({ hasText: "Posters & coloring" }).click();
  await expect(page.locator("#resource-search")).toHaveValue("");
  await expect(page.locator("#resource-search")).toBeFocused();
  await expect(page.locator("#empty-state")).toBeHidden();
  await expect(page.locator(".resource-card:visible")).toHaveCount(23);
  await expect(page.locator('[data-filter="poster"]')).toHaveAttribute("aria-pressed", "true");

  await page.fill("#resource-search", "zzzz-not-a-resource");
  await page.click("#header-language-toggle");
  await expect(page.locator(".empty-suggestion").first()).toHaveText("Actividades");
  await expect(page.locator("#results-message")).toContainText("0 recursos");
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

test("the whole library card opens the reader", async ({ page }) => {
  await page.goto("/");
  const card = page.locator(".resource-card").first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + 24);
  await expect(page.locator("#pdf-reader")).toHaveJSProperty("open", true);
  await page.click("#pdf-reader-close");
});

test("boot adopts the static library cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".resource-card[data-resource-file]")).toHaveCount(42);
  await expect(page.locator("#count-all")).toHaveText("42");
});

test("static and runtime cards render the same content", async ({ page }) => {
  await page.goto("/");
  const snapshot = () => page.evaluate(() => [...document.querySelectorAll(".resource-card")].map((card) => ({
    title: card.querySelector("h3")?.textContent || "",
    meta: card.querySelector(".resource-meta")?.textContent || "",
    type: card.querySelector(".resource-type")?.textContent || "",
    alt: card.querySelector("img")?.getAttribute("alt") || "",
    src: card.querySelector("img")?.getAttribute("src") || "",
    href: card.querySelector(".resource-link")?.getAttribute("href") || "",
    label: card.querySelector(".resource-link")?.getAttribute("aria-label") || "",
    description: card.querySelector(".resource-description")?.textContent || "",
    badges: [...card.querySelectorAll(".resource-badge")].map((badge) => badge.textContent)
  })));
  const staticCards = await snapshot();
  await page.evaluate(() => { renderedLanguage = null; renderResources(); });
  expect(await snapshot()).toEqual(staticCards);
});

test("the library is usable without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".resource-card")).toHaveCount(42);
  await expect(page.locator(".resource-card h3").first()).toHaveText("Bobber Boating Items");
  await expect(page.locator(".resource-card .resource-link").first()).toHaveAttribute(
    "href",
    /assets\/pdfs\/.+\.pdf$/
  );
  await expect(page.locator(".library-tools")).toBeHidden();
  await expect(page.locator("#menu-toggle")).toBeHidden();
  await expect(page.locator("#header-language-toggle")).toBeHidden();
  await expect(page.locator("#theme-toggle")).toBeHidden();
  await expect(page.locator(".noscript-nav")).toBeVisible();
  await expect(page.locator(".noscript-nav a")).toHaveCount(6);
  await expect(page.locator(".library-section noscript p")).toHaveText("Search and filters need JavaScript. All resources are listed below.");
  await expect(page.locator(".game-card")).toBeHidden();
  await expect(page.locator(".game-section noscript p")).toContainText("The safety game needs JavaScript.");
  await expect(page.locator("#lake-check-progress")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);

  await page.goto("/grown-ups.html");
  await expect(page.locator(".noscript-nav")).toBeVisible();
  await expect(page.locator(".noscript-nav a")).toHaveCount(6);
  await context.close();
});

test("reviewed resource metadata renders badges and filters", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#metadata-filters")).toBeHidden();

  await page.evaluate(() => {
    const resource = resources.find((item) => item.file.includes("Boating Items"));
    resource.description = {
      en: "A boating safety activity sheet with a life-jacket checklist.",
      es: "Una hoja de seguridad para navegar con una lista del chaleco salvavidas."
    };
    resource.languages = ["en", "es"];
    resource.gradeRange = "K–4";
    refreshMetadataFilters();
    renderedLanguage = null;
    renderResources();
  });

  const firstCard = page.locator(".resource-card").first();
  await expect(firstCard.locator(".resource-description")).toContainText("boating safety activity");
  await expect(firstCard.locator(".resource-badge")).toHaveCount(2);
  await expect(firstCard.locator(".resource-badge").first()).toHaveText("English · Spanish");
  await expect(firstCard.locator(".resource-badge").nth(1)).toHaveText("Grades K–4");
  await expect(page.locator("#metadata-filters")).toBeVisible();
  const filtersLayout = await page.evaluate(() => {
    const toolbar = document.querySelector(".library-tools").getBoundingClientRect();
    const search = document.querySelector(".search-box").getBoundingClientRect();
    const metadata = document.querySelector("#metadata-filters").getBoundingClientRect();
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      toolbarRight: toolbar.right,
      metadataRight: metadata.right,
      metadataBelowSearch: metadata.top >= search.bottom
    };
  });
  expect(filtersLayout.overflow).toBe(0);
  expect(filtersLayout.metadataRight).toBeLessThanOrEqual(filtersLayout.toolbarRight);
  expect(filtersLayout.metadataBelowSearch).toBe(true);
  const metadataA11y = await new AxeBuilder({ page }).include("#resources").analyze();
  expect(metadataA11y.violations).toEqual([]);

  await page.selectOption("#metadata-language-filter", "es");
  await expect(page.locator(".resource-card:visible")).toHaveCount(1);
  await page.selectOption("#metadata-grade-filter", "K–4");
  await expect(page.locator(".resource-card:visible")).toHaveCount(1);
  await page.selectOption("#metadata-language-filter", "all");
  await expect(page.locator(".resource-card:visible")).toHaveCount(1);
  await page.selectOption("#metadata-grade-filter", "all");
  await expect(page.locator(".resource-card:visible")).toHaveCount(42);

  await page.fill("#resource-search", "life-jacket checklist");
  await expect(page.locator(".resource-card:visible")).toHaveCount(1);
  await page.fill("#resource-search", "");

  await page.click("#header-language-toggle");
  await expect(page.locator(".resource-card").first().locator(".resource-description")).toContainText("seguridad para navegar");
  await expect(page.locator(".resource-card").first().locator(".resource-badge").first()).toHaveText("Inglés · Español");
  await expect(page.locator("#metadata-language-filter option").first()).toHaveText("Todos los idiomas");
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

