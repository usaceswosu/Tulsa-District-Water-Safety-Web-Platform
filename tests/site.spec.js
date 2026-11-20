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
  await page.route("**/*-web.pdf*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
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

test("grown-ups page links to the classroom pack and QR poster", async ({ page }) => {
  await page.goto("/grown-ups.html");
  await expect(page.locator('a[href*="Bobber_Classroom_Pack_2026.zip"]')).toBeVisible();
  await expect(page.locator('a[href="poster.html"]')).toBeVisible();
  const response = await page.request.head("http://127.0.0.1:4173/assets/downloads/Bobber_Classroom_Pack_2026.zip");
  expect(response.ok()).toBeTruthy();
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

test("the reader engine warms when the library approaches", async ({ page }) => {
  const moduleRequest = page.waitForRequest(/pdf\.min\.mjs/, { timeout: 15_000 });
  const workerRequest = page.waitForRequest(/pdf\.worker\.min\.mjs/, { timeout: 15_000 });
  await page.goto("/");
  await page.locator(".library-section").scrollIntoViewIfNeeded();
  await moduleRequest;
  await workerRequest;
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
