import { test, expect } from "@playwright/test";

// Proper names and labels that intentionally stay in their own language.
const ALLOWED = new Set([
  "Bobber",
  "Ranger Buck",
  "Ranger Jane",
  "Ranger Toro",
  "Corkey",
  "Sinker",
  "Español",
  "App Store",
  "Google Play",
  "Your name"
]);

// Widgets that translate their own copy in JavaScript.
const DYNAMIC_SELECTOR = [
  ".resource-grid",
  "#results-message",
  ".game-card",
  "#lake-check-progress",
  "#lake-check-say",
  "#lake-check-done",
  "#lake-check-bobber",
  "#certificate-dialog",
  "#certificate-print-sheet",
  "#info-dialog",
  "#easter-dialog",
  "#pdf-reader",
  ".language-code",
  ".ar-badge",
  '[lang="es"]'
].join(", ");

for (const path of ["/", "/grown-ups.html"]) {
  test(`${path} authored English copy has Spanish coverage`, async ({ page }) => {
    await page.goto(path);
    const missing = await page.evaluate(({ allowed, dynamicSelector }) => {
      const allow = new Set(allowed);
      const missing = [];
      for (const { node, original } of staticEnglishTextNodes) {
        const text = original.trim();
        if (!text || !/[A-Za-z]/.test(text) || allow.has(text)) continue;
        const parent = node.parentElement;
        if (!parent || parent.closest(dynamicSelector)) continue;
        if (!Object.hasOwn(BOBBER_TRANSLATIONS_ES, text)) missing.push(text);
      }
      return [...new Set(missing)];
    }, { allowed: [...ALLOWED], dynamicSelector: DYNAMIC_SELECTOR });
    expect(missing).toEqual([]);

    const untranslated = await page.evaluate(({ dynamicSelector }) => {
      setLanguage("es");
      const failures = [];
      for (const { node, original } of staticEnglishTextNodes) {
        if (!node.isConnected) continue;
        const text = original.trim();
        if (!Object.hasOwn(BOBBER_TRANSLATIONS_ES, text)) continue;
        const parent = node.parentElement;
        if (!parent || parent.closest(dynamicSelector)) continue;
        const expected = BOBBER_TRANSLATIONS_ES[text].trim();
        if (node.nodeValue.trim() !== expected) {
          failures.push({ text, expected, actual: node.nodeValue.trim() });
        }
      }
      return failures;
    }, { dynamicSelector: DYNAMIC_SELECTOR });
    expect(untranslated).toEqual([]);
  });
}
