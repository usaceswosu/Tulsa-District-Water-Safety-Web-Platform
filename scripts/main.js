/*
 * Bobber page controller.
 *
 * Loaded as a classic deferred script on index.html and grown-ups.html. Classic
 * scripts share one global scope, so top-level names must stay unique across
 * data/resources.js, data/content.js, scripts/pdf-reader.js, and this file.
 * Run `npm run check:globals` after adding a top-level name.
 *
 * Sections: data + preferences, resource library, navigation, language/theme,
 * PWA, tips, checklist, dialogs, game/certificate, scroll reveal, boot.
 */
const DAY_MS = 86_400_000;
const RESOURCE_IDLE_TIMEOUT_MS = 1200;
const RESOURCE_IDLE_FALLBACK_MS = 120;
const READER_PREFETCH_MARGIN = "500px";
const TIP_ROTATION_MS = 8000;
const CONFETTI_LIFETIME_MS = 1800;
const PWA_IDLE_TIMEOUT_MS = 2500;
const PWA_REGISTER_FALLBACK_MS = 500;
const PWA_RELOAD_FALLBACK_MS = 4000;

const resources = window.BOBBER_RESOURCES;
const categoryLabels = window.BOBBER_CATEGORY_LABELS;
const educatorPdfLinks = [...document.querySelectorAll(".educator-card a[href$='.pdf'], .educator-note a[href$='.pdf']")];
if (educatorPdfLinks.length && typeof pdfReader !== "undefined" && pdfReader && typeof openPdfReader === "function") {
  educatorPdfLinks.forEach((link) => {
    link.setAttribute("aria-haspopup", "dialog");
    // These links open the in-page reader, so do not label them as new-tab links.
    link.dataset.readerLink = "true";
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const title = link.closest(".educator-card")?.querySelector("h3")?.textContent.trim() || link.textContent.trim();
      openPdfReader(link.href, title, link);
    });
  });
}
const resourceTitlesEs = window.BOBBER_RESOURCE_TITLES_ES;
const filterLabels = window.BOBBER_FILTER_LABELS || categoryLabels;
const pdfMeta = window.BOBBER_PDF_META || {};
const spanishText = window.BOBBER_TRANSLATIONS_ES;
const pageContent = window.BOBBER_CONTENT || {};
const bobberTips = pageContent.tips || [];
const bobberLooks = pageContent.looks || {};
const checklistReactions = pageContent.reactions || [];
const palCards = pageContent.palCards || {};
const gamePool = pageContent.gamePool || [];
const appScript = [...document.scripts].find((script) => script.src.includes("main.js"));
const assetVersion = appScript ? new URL(appScript.src).searchParams.get("v") || "" : "";
// Capture authored English text once so the language toggle can switch both ways.
const staticEnglishTextNodes = [];
const textWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (textWalker.nextNode()) staticEnglishTextNodes.push({ node: textWalker.currentNode, original: textWalker.currentNode.nodeValue });

const grid = document.querySelector("#resource-grid");
const searchInput = document.querySelector("#resource-search");
const filterButtons = [...document.querySelectorAll(".filter-button")];
const resultsMessage = document.querySelector("#results-message");
const emptyState = document.querySelector("#empty-state");
let activeFilter = "all";
let currentLanguage = "en";
let resourcesRendered = false;
let resourcesScheduled = false;
let renderedLanguage = null;
let resourceCards = [];

function savePreference(name, value) {
  try {
    window.localStorage.setItem(name, value);
  } catch {
    // Preferences are optional; the page should still work when storage is blocked.
  }
}

function assetPath(filename) {
  return `assets/${filename.split("/").map(encodeURIComponent).join("/")}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const locale = currentLanguage === "es" ? "es" : "en";
  if (bytes >= 1048576) {
    const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1048576);
    return `${value} MB`;
  }
  return `${new Intl.NumberFormat(locale).format(Math.round(bytes / 1024))} KB`;
}

function formatPageCount(pages) {
  if (!Number.isFinite(pages) || pages <= 0) return "";
  return currentLanguage === "es"
    ? `${pages} ${pages === 1 ? "página" : "páginas"}`
    : `${pages} ${pages === 1 ? "page" : "pages"}`;
}

// Resource library: cards use local PDFs and previews from the repository.
function makeCard(resource) {
  const displayTitle = currentLanguage === "es" ? (resourceTitlesEs[resource.title] || resource.title) : resource.title;
  const meta = pdfMeta[resource.file] || {};
  const printFile = assetPath(resource.file);
  const previewFile = meta.webFile
    ? `${assetPath(meta.webFile)}${assetVersion ? `?v=${encodeURIComponent(assetVersion)}` : ""}`
    : printFile;
  const placeholderFile = assetPath(`graphics/${resource.image}`);
  const article = document.createElement("article");
  article.className = "resource-card";

  const preview = document.createElement("div");
  preview.className = "resource-thumb";
  const image = document.createElement("img");
  image.src = assetPath(`graphics/${resource.image}`);
  image.alt = currentLanguage === "es" ? `Vista previa para imprimir: ${displayTitle}` : `${displayTitle} printable preview`;
  image.loading = "lazy";
  image.decoding = "async";
  const type = document.createElement("span");
  type.className = "resource-type";
  type.textContent = categoryLabels[currentLanguage][resource.category];
  preview.append(image, type);

  const body = document.createElement("div");
  body.className = "resource-body";
  const title = document.createElement("h3");
  title.textContent = displayTitle;
  const metaLine = document.createElement("p");
  metaLine.className = "resource-meta";
  metaLine.textContent = [formatPageCount(meta.pages), formatFileSize(meta.bytes)].filter(Boolean).join(" · ");
  const link = document.createElement("a");
  link.className = "resource-link";
  link.href = printFile;
  link.target = "_blank";
  link.rel = "noopener";
  link.setAttribute("aria-haspopup", "dialog");
  link.addEventListener("click", (event) => {
    const readerReady = typeof pdfReader !== "undefined" && pdfReader && "showModal" in pdfReader && typeof openPdfReader === "function";
    if (!readerReady || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    openPdfReader(previewFile, displayTitle, link, printFile, Boolean(meta.webFile), placeholderFile);
  });
  const linkLabel = document.createElement("span");
  linkLabel.textContent = currentLanguage === "es"
    ? (resource.category === "storybook" ? "Leer el cuento" : "Abrir PDF para imprimir")
    : (resource.category === "storybook" ? "Read the story" : "Open printable PDF");
  link.setAttribute("aria-label", `${linkLabel.textContent}: ${displayTitle}`);
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "→";
  link.append(linkLabel, arrow);
  body.append(title);
  if (metaLine.textContent) body.append(metaLine);
  body.append(link);
  article.append(preview, body);
  return article;
}

function resourceMatches(resource, query) {
  const matchesCategory = activeFilter === "all" || resource.category === activeFilter;
  if (!matchesCategory) return false;
  if (!query) return true;
  const searchableTitle = currentLanguage === "es"
    ? `${resource.title} ${resourceTitlesEs[resource.title] || ""}`
    : resource.title;
  return searchableTitle.toLowerCase().includes(query);
}

function renderResources() {
  if (!grid || !searchInput) return;
  resourcesRendered = true;
  const query = searchInput.value.trim().toLowerCase();

  // Rebuild only when the language changes; filtering reuses the existing cards.
  if (renderedLanguage !== currentLanguage || resourceCards.length !== resources.length) {
    resourceCards = resources.map((resource) => ({ resource, card: makeCard(resource) }));
    grid.replaceChildren(...resourceCards.map(({ card }) => card));
    renderedLanguage = currentLanguage;
  }

  const visibleResources = [];
  for (const { resource, card } of resourceCards) {
    const visible = resourceMatches(resource, query);
    card.hidden = !visible;
    if (visible) visibleResources.push(resource);
  }

  emptyState.hidden = visibleResources.length !== 0;
  const count = visibleResources.length;
  resultsMessage.textContent = currentLanguage === "es"
    ? `${count} ${count === 1 ? "recurso" : "recursos"}${query ? ` para “${searchInput.value.trim()}”` : ""}`
    : `${count} ${count === 1 ? "resource" : "resources"}${query ? ` matching “${searchInput.value.trim()}”` : ""}`;
}

function scheduleResources() {
  if (resourcesRendered || resourcesScheduled) return;
  resourcesScheduled = true;
  const run = () => {
    resourcesScheduled = false;
    if (!resourcesRendered) renderResources();
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: RESOURCE_IDLE_TIMEOUT_MS });
  else window.setTimeout(run, RESOURCE_IDLE_FALLBACK_MS);
}

function warmPdfEngine() {
  window.prefetchPdfEngine?.();
}

if (grid && searchInput) {
  grid.addEventListener("pointerover", warmPdfEngine, { once: true });
  grid.addEventListener("focusin", warmPdfEngine, { once: true });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeFilter = button.dataset.filter;
      filterButtons.forEach((item) => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", String(selected));
      });
      renderResources();
    });
  });

  searchInput.addEventListener("input", renderResources);
  const resetSearch = document.querySelector("#reset-search");
  if (resetSearch) {
    resetSearch.addEventListener("click", () => {
      searchInput.value = "";
      activeFilter = "all";
      filterButtons.forEach((button) => {
        const selected = button.dataset.filter === "all";
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      renderResources();
      searchInput.focus();
    });
  }
  const countAll = document.querySelector("#count-all");
  if (countAll) countAll.textContent = resources.length;
}

const readerWarmTarget = grid?.closest(".library-section") || document.querySelector(".educator-section");
if (readerWarmTarget && "IntersectionObserver" in window) {
  const readerWarmObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      warmPdfEngine();
      readerWarmObserver.disconnect();
    }
  }, { rootMargin: READER_PREFETCH_MARGIN });
  readerWarmObserver.observe(readerWarmTarget);
}

const menuToggle = document.querySelector("#menu-toggle");
const siteNav = document.querySelector("#site-nav");
function menuButtonLabel(isOpen) {
  if (currentLanguage === "es") return isOpen ? "Cerrar el menú" : "Abrir el menú";
  return isOpen ? "Close navigation" : "Open navigation";
}

if (menuToggle && siteNav) {
  menuToggle.addEventListener("click", () => {
    const isExpanded = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!isExpanded));
    menuToggle.setAttribute("aria-label", menuButtonLabel(!isExpanded));
    siteNav.classList.toggle("is-open", !isExpanded);
  });
  siteNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", menuButtonLabel(false));
    siteNav.classList.remove("is-open");
  }));
}
// Keyboard shortcuts for responsive navigation and the resource search.
document.addEventListener("keydown", (event) => {
  if (document.querySelector("dialog[open]")) return;
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", menuButtonLabel(false));
    siteNav.classList.remove("is-open");
    menuToggle.focus();
  }
  const active = document.activeElement;
  const isTyping = active?.matches("input, textarea, select, [contenteditable='true'], [role='textbox']");
  if (event.key === "/" && searchInput && !isTyping) {
    event.preventDefault();
    searchInput.focus();
  }
});

const headerLanguageToggle = document.querySelector("#header-language-toggle");
const spanishSafetyCopy = [...document.querySelectorAll(".spanish-copy")];
const englishSafetyCopy = [...document.querySelectorAll(".safety-card > p")];
function updateExternalLinkLabels() {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    const isReaderLink = link.dataset.readerLink === "true";
    if (!isReaderLink && link.hasAttribute("aria-label") && link.dataset.autoExternalLabel !== "true") return;
    const label = [...link.childNodes]
      .map((node) => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("aria-hidden") ? "" : node.textContent)
      .join(" ")
      .replace(/[↗→]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) return;
    link.dataset.autoExternalLabel = "true";
    if (isReaderLink) {
      link.setAttribute("aria-label", label);
    } else {
      link.setAttribute("aria-label", currentLanguage === "es" ? `${label} (se abre en una pestaña nueva)` : `${label} (opens in a new tab)`);
    }
  });
}

// Update visible copy, document language, and accessible labels together.
function setLanguage(language) {
  currentLanguage = language;
  const isSpanish = language === "es";

  // Document metadata and URL.
  document.documentElement.lang = language;
  document.documentElement.dataset.locale = language;
  savePreference("bobber-language", language);
  try {
    const url = new URL(window.location.href);
    if (isSpanish) url.searchParams.set("lang", "es");
    else url.searchParams.delete("lang");
    window.history.replaceState(null, "", url.href);
  } catch {
    // History is unavailable in some embedded previews; the language still changes.
  }
  const isGrownUpsPage = document.body.dataset.page === "grownups";
  document.title = isGrownUpsPage
    ? (isSpanish ? "Para adultos | Bobber, el perro de seguridad acuática" : "For grown-ups | Bobber the Water Safety Dog")
    : (isSpanish ? "Bobber, el perro de seguridad acuática | Distrito de Tulsa, USACE" : "Bobber the Water Safety Dog | Tulsa District, USACE");
  const description = document.querySelector('meta[name="description"]');
  if (description) {
    if (isGrownUpsPage) {
      description.content = isSpanish
        ? "Planificación de visitas al lago, la app del Distrito de Tulsa de USACE y materiales para el aula del perro de seguridad acuática Bobber."
        : "Lake visit planning, the USACE Tulsa District app, and classroom materials for teachers and grown-ups, from Bobber the Water Safety Dog.";
    } else {
      description.content = isSpanish
        ? "Conoce a Bobber y encuentra consejos de seguridad acuática en español, dibujos animados y recursos para imprimir del Distrito de Tulsa del Cuerpo de Ingenieros del Ejército de EE. UU."
        : "Meet Bobber the Water Safety Dog. Explore family-friendly water safety videos, printable activities, posters, coloring sheets, and storybooks from the U.S. Army Corps of Engineers Tulsa District.";
    }
  }

  // Authored text captured at boot. Dynamic widgets are handled below.
  for (const { node, original } of staticEnglishTextNodes) {
    if (!node.isConnected) continue;
    const text = original.trim();
    const translated = isSpanish ? spanishText[text] : undefined;
    const next = translated ? original.replace(text, translated) : original;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  const heroTitle = document.querySelector("#hero-title");
  if (heroTitle) {
    const nextTitle = isSpanish
      ? "Disfruta del agua<br><span>con seguridad</span>."
      : "Big fun.<br><span>Water-safe</span> adventures.";
    if (heroTitle.innerHTML !== nextTitle) heroTitle.innerHTML = nextTitle;
  }

  // Header, navigation, and accessible names.
  const languageCode = headerLanguageToggle.querySelector(".language-code");
  const languageName = headerLanguageToggle.querySelector(".language-name");
  languageCode.textContent = isSpanish ? "EN" : "ES";
  languageName.textContent = isSpanish ? "Inglés" : "Español";
  languageName.lang = "es";
  headerLanguageToggle.setAttribute("aria-pressed", String(isSpanish));
  headerLanguageToggle.setAttribute("aria-label", isSpanish ? "EN Inglés" : "ES Español");
  headerLanguageToggle.title = isSpanish ? "Inglés — cambiar toda la página a inglés" : "Español — switch the entire page to Spanish";

  menuToggle.setAttribute("aria-label", menuButtonLabel(menuToggle.getAttribute("aria-expanded") === "true"));
  siteNav.setAttribute("aria-label", isSpanish ? "Navegación principal" : "Main navigation");
  document.querySelector(".skip-link").setAttribute("aria-label", isSpanish ? "Saltar al contenido" : "Skip to content");
  document.querySelector(".quick-strip")?.setAttribute("aria-label", isSpanish ? "Explora el sitio" : "Explore the site");
  document.querySelectorAll('a[href="accessibility.html"], a[href="accessibility.html#espanol"]').forEach((link) => {
    link.href = isSpanish ? "accessibility.html#espanol" : "accessibility.html";
  });
  document.querySelector(".filters")?.setAttribute("aria-label", isSpanish ? "Filtrar recursos" : "Filter resources");
  if (searchInput) {
    searchInput.setAttribute("aria-label", isSpanish ? "Buscar recursos de Bobber" : "Search Bobber resources");
    searchInput.placeholder = isSpanish ? "Buscar actividades, afiches y cuentos…" : "Search activities, posters, books…";
  }
  document.querySelector(".hero-feature")?.setAttribute("aria-label", isSpanish ? "Consejo de seguridad acuática de Bobber" : "Bobber’s water safety reminder");
  const noteImage = document.querySelector(".bobber-note img");
  if (noteImage) noteImage.alt = isSpanish ? "Bobber, el perro de seguridad acuática" : "Bobber the Water Safety Dog";

  // Card-level language panels.
  englishSafetyCopy.forEach((copy) => { copy.hidden = isSpanish; });
  spanishSafetyCopy.forEach((copy) => { copy.hidden = !isSpanish; });
  spanishSafetyCopy.forEach((copy) => {
    const label = copy.querySelector(":scope > span");
    if (label) label.textContent = isSpanish ? "BORRADOR · TRADUCCIÓN" : "ESPAÑOL · BORRADOR";
  });

  // Library, widgets, and cross-page labels.
  filterButtons.forEach((button) => {
    const key = button.dataset.filter;
    const label = button.querySelector("span");
    const text = filterLabels[language][key];
    if (label) {
      button.firstChild.textContent = `${text} `;
    } else {
      button.textContent = text;
    }
  });
  if (resourcesRendered) renderResources();
  else scheduleResources();
  updateThemeControl();
  if (typeof window.updatePdfReaderLanguage === "function") window.updatePdfReaderLanguage();
  updateExternalLinkLabels();
  updateEasterDialogLanguage();
  if (infoClose) infoClose.setAttribute("aria-label", isSpanish ? "Cerrar" : "Close");
  document.querySelectorAll(".card-open").forEach((button) => {
    const title = button.closest(".safety-card, .friends-row li")?.querySelector("h3, strong")?.textContent.trim() || button.dataset.title;
    if (title) button.dataset.title = title;
    button.setAttribute("aria-label", `${isSpanish ? "Abrir detalles" : "Open details"}: ${title}`);
  });
  if (infoDialog?.open) infoDialog.close();
  updateSpeechBubble();
  updateChecklist();
  renderGame();
  updateCertificateLanguage();
  updatePwaCopy();
}

let offlineBanner;
let updateBanner;
let swRegistration;
let pwaReloadRequested = false;

function updatePwaCopy() {
  if (!offlineBanner || !updateBanner) return;
  const isSpanish = currentLanguage === "es";
  offlineBanner.textContent = isSpanish
    ? "Estás sin conexión. Los consejos de seguridad de Bobber siguen disponibles."
    : "You’re offline. Bobber’s safety tips are still available.";
  offlineBanner.hidden = navigator.onLine;
  const label = updateBanner.querySelector("span");
  const button = updateBanner.querySelector("button");
  if (label) label.textContent = isSpanish ? "Hay una nueva versión de Bobber." : "A new version of Bobber is ready.";
  if (button) button.textContent = isSpanish ? "Actualizar" : "Refresh";
}

function showUpdateBanner() {
  if (!updateBanner || !navigator.serviceWorker.controller) return;
  updatePwaCopy();
  updateBanner.hidden = false;
}

function setupPwa() {
  if (!("serviceWorker" in navigator) || !/^https?:$/.test(location.protocol)) return;
  const stack = document.createElement("div");
  stack.className = "pwa-stack";
  offlineBanner = document.createElement("div");
  offlineBanner.className = "pwa-banner";
  offlineBanner.hidden = true;
  offlineBanner.setAttribute("role", "status");
  updateBanner = document.createElement("div");
  updateBanner.className = "pwa-banner";
  updateBanner.hidden = true;
  updateBanner.setAttribute("role", "status");
  const message = document.createElement("span");
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.className = "pwa-action";
  refresh.addEventListener("click", () => {
    pwaReloadRequested = true;
    const waiting = swRegistration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: "SKIP_WAITING" });
      window.setTimeout(() => { if (pwaReloadRequested) location.reload(); }, PWA_RELOAD_FALLBACK_MS);
    } else {
      location.reload();
    }
  });
  updateBanner.append(message, refresh);
  stack.append(offlineBanner, updateBanner);
  document.body.append(stack);
  updatePwaCopy();

  window.addEventListener("online", updatePwaCopy);
  window.addEventListener("offline", updatePwaCopy);
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (pwaReloadRequested) location.reload();
  });

  window.addEventListener("load", () => {
    const register = async () => {
      try {
        swRegistration = await navigator.serviceWorker.register(`sw.js${assetVersion ? `?v=${encodeURIComponent(assetVersion)}` : ""}`);
        if (swRegistration.waiting) showUpdateBanner();
        swRegistration.addEventListener("updatefound", () => {
          const worker = swRegistration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateBanner();
          });
        });
      } catch {
        // Offline support is an enhancement; the site works without it.
      }
    };
    if ("requestIdleCallback" in window) window.requestIdleCallback(register, { timeout: PWA_IDLE_TIMEOUT_MS });
    else window.setTimeout(register, PWA_REGISTER_FALLBACK_MS);
  });
}

headerLanguageToggle.addEventListener("click", () => {
  setLanguage(currentLanguage === "en" ? "es" : "en");
});

const themeToggle = document.querySelector("#theme-toggle");
const themeIcon = themeToggle.querySelector(".theme-icon");
const themeLabel = themeToggle.querySelector(".theme-label");

// Theme preferences remain usable when browser storage is unavailable.
function updateThemeControl() {
  const isDark = document.documentElement.dataset.theme === "dark";
  themeToggle.setAttribute("aria-pressed", String(isDark));
  const nextMode = currentLanguage === "es" ? (isDark ? "claro" : "oscuro") : (isDark ? "light" : "dark");
  themeToggle.setAttribute("aria-label", currentLanguage === "es" ? `Cambiar al modo ${nextMode}` : `Switch to ${nextMode} mode`);
  themeToggle.title = currentLanguage === "es" ? `Cambiar al modo ${nextMode}` : `Switch to ${nextMode} mode`;
  themeIcon.textContent = isDark ? "☼" : "◐";
  themeLabel.textContent = currentLanguage === "es" ? (isDark ? "Claro" : "Oscuro") : (isDark ? "Light" : "Dark");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = isDark ? "#101c20" : "#fffefa";
}

// Hidden Konami-code easter egg.
const easterDialog = document.querySelector("#easter-dialog");
const easterConfetti = document.querySelector("#easter-confetti");
function updateEasterDialogLanguage() {
  if (!easterDialog) return;
  const isSpanish = currentLanguage === "es";
  document.querySelector("#easter-kicker").textContent = isSpanish ? "Misión secreta desbloqueada" : "Secret mission unlocked";
  document.querySelector("#easter-title").textContent = isSpanish ? "¡Encontraste a Bobber!" : "You found Bobber!";
  document.querySelector("#easter-copy").textContent = isSpanish
    ? "Tu misión secreta: ve con un compañero, usa un chaleco salvavidas y comparte un consejo de seguridad acuática."
    : "Your secret mission: bring a buddy, wear a life jacket, and share one water-safety tip.";
  document.querySelector("#easter-return-label").textContent = isSpanish ? "Volver a la aventura" : "Back to the adventure";
  document.querySelector("#easter-close").setAttribute("aria-label", isSpanish ? "Cerrar la misión secreta" : "Close secret mission");
  document.querySelector(".easter-logo").alt = isSpanish ? "Logotipo de Bobber, el perro de seguridad acuática" : "Bobber the Water Safety Dog logo";
}

function addEasterEggConfetti() {
  const colors = ["#f17658", "#f7d978", "#167e79", "#73bed0", "#e45b71"];
  const pieces = Array.from({ length: 20 }, (_, index) => {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${(index * 47 + 3) % 100}%`);
    piece.style.setProperty("--delay", `${(index % 7) * 0.055}s`);
    piece.style.setProperty("--turn", `${index * 53}deg`);
    piece.style.setProperty("--piece", colors[index % colors.length]);
    return piece;
  });
  easterConfetti.replaceChildren(...pieces);
}

if (easterDialog) {
  document.querySelector("#easter-close").addEventListener("click", () => easterDialog.close());
  document.querySelector("#easter-return").addEventListener("click", () => easterDialog.close());
  easterDialog.addEventListener("click", (event) => {
    if (event.target === easterDialog) easterDialog.close();
  });
}

const konamiSequence = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let konamiProgress = 0;
function normalizeKonamiKey(event) {
  const codeKeys = { Numpad8: "ArrowUp", Numpad2: "ArrowDown", Numpad4: "ArrowLeft", Numpad6: "ArrowRight", KeyB: "b", KeyA: "a" };
  const legacyKeys = { 38: "ArrowUp", 40: "ArrowDown", 37: "ArrowLeft", 39: "ArrowRight", 66: "b", 65: "a" };
  if (konamiSequence.includes(event.key)) return event.key;
  if (event.key.length === 1 && konamiSequence.includes(event.key.toLowerCase())) return event.key.toLowerCase();
  return codeKeys[event.code] || legacyKeys[event.which || event.keyCode] || event.key;
}

document.addEventListener("keydown", (event) => {
  if (!easterDialog || document.querySelector("dialog[open]") || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  const active = document.activeElement;
  if (active?.matches("input, textarea, select, [contenteditable='true'], [role='textbox']")) {
    konamiProgress = 0;
    return;
  }
  const key = normalizeKonamiKey(event);
  if (key === konamiSequence[konamiProgress]) {
    konamiProgress += 1;
    if (konamiProgress === konamiSequence.length) {
      konamiProgress = 0;
      event.preventDefault();
      updateEasterDialogLanguage();
      addEasterEggConfetti();
      easterDialog.showModal();
      document.querySelector("#easter-close").focus();
    }
    return;
  }
  konamiProgress = key === konamiSequence[0] ? 1 : 0;
});

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  savePreference("bobber-theme", nextTheme);
  updateThemeControl();
});
// Bobber starts with the tip of the day, then keeps sharing more reminders while the page is open.
const speechBubble = document.querySelector(".speech-bubble");
let tipIndex = bobberTips.length ? Math.floor(Date.now() / DAY_MS) % bobberTips.length : 0;

function renderSpeechBubble() {
  if (!speechBubble || !bobberTips.length) return;
  speechBubble.textContent = bobberTips[tipIndex % bobberTips.length][currentLanguage];
}

function updateSpeechBubble() {
  renderSpeechBubble();
  if (readySay) readySay.textContent = currentLanguage === "es" ? "¡Marca cada uno!" : "Tick each one!";
}

function advanceSpeechBubble() {
  if (!bobberTips.length) return;
  tipIndex = (tipIndex + 1) % bobberTips.length;
  renderSpeechBubble();
  if (speechBubble && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    speechBubble.animate(
      [{ opacity: 0, translate: "0 3px" }, { opacity: 1, translate: "0 0" }],
      { duration: 320, easing: "ease-out" }
    );
  }
}

let speechTimer = null;
function startSpeechRotation() {
  if (!speechBubble || !bobberTips.length || speechTimer) return;
  speechTimer = window.setInterval(advanceSpeechBubble, TIP_ROTATION_MS);
}

function stopSpeechRotation() {
  if (speechTimer) window.clearInterval(speechTimer);
  speechTimer = null;
}

if (speechBubble) {
  if (!document.hidden) startSpeechRotation();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopSpeechRotation();
    else startSpeechRotation();
  });
}

// Small confetti burst for finished activities; skipped when motion is reduced.
function burstConfetti(container) {
  if (!container || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  const colors = ["#f17658", "#f7d978", "#167e79", "#73bed0", "#e45b71"];
  for (let index = 0; index < 18; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${(index * 37 + 7) % 100}%`);
    piece.style.setProperty("--delay", `${(index % 6) * 0.05}s`);
    piece.style.setProperty("--turn", `${index * 47}deg`);
    piece.style.setProperty("--piece", colors[index % colors.length]);
    layer.append(piece);
  }
  container.append(layer);
  window.setTimeout(() => layer.remove(), CONFETTI_LIFETIME_MS);
}

const readyBoxes = [...document.querySelectorAll(".lake-check-list input")];
let checklistDone = false;
const readyProgress = document.querySelector("#lake-check-progress");
const readyDone = document.querySelector("#lake-check-done");
const readyBobber = document.querySelector(".lake-check-bobber");
const readyBobberImg = document.querySelector("#lake-check-bobber-img");
const readySay = document.querySelector("#lake-check-say");
const reactions = [...document.querySelectorAll(".reaction")];
Object.values(bobberLooks).forEach((src) => { const preload = new Image(); preload.src = src; });

// Bobber starts without his life jacket; ticking the boxes dresses him and adds his buddy.
function updateBobberLook() {
  if (!readyBobberImg) return;
  const jacketOn = Boolean(readyBoxes[0]?.checked);
  const buddyOn = Boolean(readyBoxes[1]?.checked);
  const next = buddyOn ? bobberLooks.buddy : jacketOn ? bobberLooks.jacket : bobberLooks.bare;
  if (next && readyBobberImg.getAttribute("src") !== next) readyBobberImg.src = next;
  readyBobber?.classList.toggle("is-buddy", buddyOn);
}

function updateChecklist(reactedBox) {
  if (!readyProgress) return;
  const done = readyBoxes.filter((box) => box.checked).length;
  readyBoxes.forEach((box) => box.closest("label").classList.toggle("is-checked", box.checked));
  reactions.forEach((reaction, index) => reaction.classList.toggle("is-on", Boolean(readyBoxes[index]?.checked)));
  updateBobberLook();
  readyProgress.textContent = currentLanguage === "es"
    ? `${done} de ${readyBoxes.length} listos`
    : `${done} of ${readyBoxes.length} ready`;
  readyDone.hidden = done !== readyBoxes.length;

  const nowDone = done === readyBoxes.length;
  if (nowDone && !checklistDone) burstConfetti(document.querySelector(".lake-check"));
  checklistDone = nowDone;

  if (readySay) {
    const index = readyBoxes.indexOf(reactedBox);
    const reaction = index >= 0 ? checklistReactions[index] : null;
    if (reaction && reactedBox.checked) {
      readySay.textContent = currentLanguage === "es" ? reaction.say.es : reaction.say.en;
    } else {
      readySay.textContent = currentLanguage === "es" ? "¡Marca cada uno!" : "Tick each one!";
    }
  }
  if (readyBobber && reactedBox && reactedBox.checked) {
    readyBobber.classList.remove("is-happy");
    void readyBobber.offsetWidth;
    readyBobber.classList.add("is-happy");
  }
}

readyBoxes.forEach((box) => box.addEventListener("change", () => updateChecklist(box)));
updateSpeechBubble();
updateChecklist();

// Cards open a detail dialog when clicked, with keyboard support.
const infoDialog = document.querySelector("#info-dialog");
const infoArt = document.querySelector("#info-art");
const infoKicker = document.querySelector("#info-kicker");
const infoTitle = document.querySelector("#info-title");
const infoCopy = document.querySelector("#info-copy");
const infoClose = document.querySelector("#info-close");
const infoLink = document.querySelector("#info-link");

function openInfoCard({ art, kicker, title, copy, link }) {
  if (!infoDialog) return;
  infoArt.src = art;
  infoArt.alt = "";
  infoKicker.textContent = kicker;
  infoTitle.textContent = title;
  infoCopy.textContent = copy;
  if (infoLink) {
    infoLink.hidden = !link;
    if (link) {
      infoLink.href = link.href;
      infoLink.textContent = link.label;
      const arrow = document.createElement("span");
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = " ↗";
      infoLink.append(arrow);
      updateExternalLinkLabels();
    }
  }
  infoDialog.showModal();
}

function makeCardOpen(container, getInfo) {
  if (!container || !infoDialog) return;
  const open = () => {
    const info = getInfo();
    if (info) openInfoCard(info);
  };
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-open";
  button.dataset.title = container.querySelector("h3, strong")?.textContent || "";
  button.setAttribute("aria-haspopup", "dialog");
  button.setAttribute("aria-label", `Open details: ${button.dataset.title}`);
  button.addEventListener("click", open);
  container.classList.add("is-clickable");
  container.append(button);
}

if (infoDialog) {
  document.querySelectorAll(".safety-card").forEach((card) => {
    makeCardOpen(card, () => ({
      art: card.querySelector(".safety-art")?.getAttribute("src") || "",
      kicker: currentLanguage === "es" ? "Seguridad acuática" : "Water safety",
      title: card.querySelector("h3")?.textContent || "",
      copy: card.querySelector(":scope > h3 + p")?.textContent || ""
    }));
  });

  document.querySelectorAll(".friends-row li").forEach((pal) => {
    makeCardOpen(pal, () => {
      const name = pal.querySelector("strong")?.textContent || "";
      const card = palCards[name];
      if (!card) return null;
      return {
        art: card.art,
        kicker: currentLanguage === "es" ? "Tarjeta coleccionable oficial" : "Official trading card",
        title: name,
        copy: currentLanguage === "es" ? card.rule.es : card.rule.en,
        link: {
          href: `assets/pdfs/Splash_Trading_Card_Game.pdf#page=${card.page}`,
          label: currentLanguage === "es" ? "Abrir la tarjeta para imprimir" : "Open the printable card"
        }
      };
    });
  });

  infoClose.addEventListener("click", () => infoDialog.close());
  infoDialog.addEventListener("click", (event) => {
    if (event.target === infoDialog) infoDialog.close();
  });
}

const GAME_ROUNDS = 4;

const gameArt = document.querySelector("#game-art");
const gameQuestion = document.querySelector("#game-question");
const gameOptions = document.querySelector("#game-options");
const gameProgress = document.querySelector("#game-progress");
const gameFeedback = document.querySelector("#game-feedback");
const gameNext = document.querySelector("#game-next");
const gameNextLabel = document.querySelector("#game-next-label");
const gameResult = document.querySelector("#game-result");
const gameRestart = document.querySelector("#game-restart");
const gameFinishActions = document.querySelector("#game-finish-actions");
const gameCertificate = document.querySelector("#game-certificate");
const gameRestartLabel = document.querySelector("#game-restart-label");
const gameCertificateLabel = document.querySelector("#game-certificate-label");
const certificateDialog = document.querySelector("#certificate-dialog");
const certificateName = document.querySelector("#certificate-name");
const certificatePreviewName = document.querySelector("#certificate-preview-name");
const certificatePreviewDate = document.querySelector("#certificate-preview-date");
const certificatePrintSection = document.querySelector("#certificate-print-sheet");
const certificatePrintName = document.querySelector("#certificate-print-name");
const certificatePrintDate = document.querySelector("#certificate-print-date");
const gameState = {
  index: 0,
  score: 0,
  answered: false,
  chosen: -1,
  done: false,
  rounds: [],
  orders: [],
  answers: []
};

function gameText(pair) {
  return currentLanguage === "es" ? pair.es : pair.en;
}

function shuffle(values) {
  const out = values.slice();
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

function startGame() {
  if (!gamePool.length) return;
  const picks = shuffle(gamePool.map((_, index) => index)).slice(0, GAME_ROUNDS);
  gameState.rounds = picks.map((index) => gamePool[index]);
  gameState.orders = gameState.rounds.map((round) => shuffle(round.options.map((_, index) => index)));
  gameState.index = 0;
  gameState.score = 0;
  gameState.answered = false;
  gameState.chosen = -1;
  gameState.done = false;
  gameState.answers = [];
}

function renderGame() {
  if (!gameOptions || !gamePool.length) return;
  if (!gameState.rounds.length) startGame();
  const total = gameState.rounds.length;

  if (gameState.done) {
    gameProgress.textContent = "";
    gameQuestion.hidden = true;
    gameArt.hidden = true;
    gameOptions.replaceChildren();
    gameFeedback.textContent = "";
    gameNext.hidden = true;
    gameResult.hidden = false;
    gameResult.replaceChildren();

    const score = document.createElement("p");
    score.className = "game-score";
    score.textContent = gameText({ en: `You got ${gameState.score} of ${total} right!`, es: `¡Acertaste ${gameState.score} de ${total}!` });

    const review = document.createElement("div");
    review.className = "game-review";
    const reviewTitle = document.createElement("h3");
    reviewTitle.className = "game-review-title";
    reviewTitle.textContent = gameText({ en: "Answer review", es: "Repaso de respuestas" });
    const list = document.createElement("ol");
    list.className = "game-review-list";
    gameState.rounds.forEach((round, index) => {
      const answer = gameState.answers[index];
      if (!answer) return;
      const item = document.createElement("li");
      item.className = `game-review-item ${answer.isCorrect ? "is-correct" : "is-missed"}`;
      const question = document.createElement("p");
      question.className = "game-review-question";
      question.textContent = gameText(round.question);
      const response = document.createElement("p");
      response.className = "game-review-answer";
      response.textContent = answer.isCorrect
        ? `✓ ${gameText({ en: "Correct", es: "Correcto" })}: ${gameText(round.options[answer.chosen])}`
        : `${gameText({ en: "Your answer", es: "Tu respuesta" })}: ${gameText(round.options[answer.chosen])} · ${gameText({ en: "Safe answer", es: "Respuesta segura" })}: ${gameText(round.options[answer.correct])}`;
      item.append(question, response);
      list.append(item);
    });
    const link = document.createElement("a");
    link.className = "game-review-link";
    link.href = "#safety";
    link.textContent = gameText({ en: "Review the safety basics", es: "Repasa lo básico de seguridad" });
    review.append(reviewTitle, list, link);
    gameResult.append(score, review);
    gameFinishActions.hidden = false;
    gameRestart.hidden = false;
    gameCertificate.hidden = false;
    return;
  }

  const round = gameState.rounds[gameState.index];
  const order = gameState.orders[gameState.index];
  gameResult.hidden = true;
  gameFinishActions.hidden = true;
  gameQuestion.hidden = false;
  gameArt.hidden = false;
  gameProgress.textContent = gameText({ en: `Question ${gameState.index + 1} of ${total}`, es: `Pregunta ${gameState.index + 1} de ${total}` });
  gameQuestion.textContent = gameText(round.question);
  gameArt.src = round.art;
  gameArt.alt = gameText(round.alt);

  const correctIndex = order.findIndex((sourceIndex) => round.options[sourceIndex].correct);
  gameOptions.replaceChildren(...order.map((sourceIndex, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-option";
    button.textContent = gameText(round.options[sourceIndex]);
    if (gameState.answered) {
      button.disabled = true;
      if (index === correctIndex) button.classList.add("is-correct");
      if (index === gameState.chosen && index !== correctIndex) button.classList.add("is-wrong");
    } else {
      button.addEventListener("click", () => chooseGameOption(index));
    }
    return button;
  }));

  if (gameState.answered) {
    const isRight = gameState.chosen === correctIndex;
    gameFeedback.textContent = isRight
      ? gameText({ en: "That’s right!", es: "¡Correcto!" })
      : gameText({ en: "Not quite. The safe answer is: ", es: "Casi. La respuesta segura es: " }) + gameText(round.options[order[correctIndex]]);
    gameNextHidden();
  } else {
    gameFeedback.textContent = "";
    gameNext.hidden = true;
  }
}

function gameNextHidden() {
  gameNext.hidden = false;
  gameNextLabel.textContent = gameState.index === gameState.rounds.length - 1
    ? gameText({ en: "See my score", es: "Ver mi resultado" })
    : gameText({ en: "Next question", es: "Siguiente pregunta" });
}

function chooseGameOption(index) {
  const round = gameState.rounds[gameState.index];
  const order = gameState.orders[gameState.index];
  const correctIndex = order.findIndex((sourceIndex) => round.options[sourceIndex].correct);
  gameState.answered = true;
  gameState.chosen = index;
  gameState.answers[gameState.index] = {
    chosen: order[index],
    correct: order[correctIndex],
    isCorrect: index === correctIndex
  };
  if (index === correctIndex) gameState.score += 1;
  renderGame();
  gameNext.focus();
}

function certificateNameValue() {
  if (!certificateName) return "";
  return certificateName.value.trim() || gameText({ en: "Safety Hero", es: "Héroe de seguridad" });
}

function certificateDateValue() {
  return new Intl.DateTimeFormat(currentLanguage === "es" ? "es-US" : "en-US", { dateStyle: "long" }).format(new Date());
}

function updateCertificatePreview() {
  if (!certificatePreviewName) return;
  certificatePreviewName.textContent = certificateNameValue();
  certificatePreviewDate.textContent = certificateDateValue();
}

function updateCertificateLanguage() {
  if (!certificateDialog) return;
  const isSpanish = currentLanguage === "es";
  document.querySelector("#certificate-kicker").textContent = isSpanish ? "El héroe de seguridad de Bobber" : "Bobber’s Safety Hero";
  document.querySelector("#certificate-title").textContent = isSpanish ? "¡Hazlo oficial!" : "Make it official!";
  document.querySelector("#certificate-copy").textContent = isSpanish
    ? "Escribe tu nombre e imprime tu certificado de héroe de seguridad. Tu nombre permanece en esta pestaña del navegador."
    : "Type your name and print your Safety Hero certificate. Your name stays in this browser tab.";
  document.querySelector("#certificate-name-label").textContent = isSpanish ? "Tu nombre" : "Your name";
  certificateName.placeholder = isSpanish ? "Tu nombre" : "Your name";
  document.querySelector("#certificate-preview-kicker").textContent = isSpanish ? "Héroe de seguridad" : "Safety Hero";
  document.querySelector("#certificate-print-label").textContent = isSpanish ? "Imprimir mi certificado" : "Print my certificate";
  document.querySelector("#certificate-cancel-label").textContent = isSpanish ? "Todavía no" : "Not yet";
  document.querySelector("#certificate-close").setAttribute("aria-label", isSpanish ? "Cerrar" : "Close");
  gameCertificateLabel.textContent = isSpanish ? "Imprimir mi certificado de héroe de seguridad" : "Print my Safety Hero certificate";
  gameRestartLabel.textContent = isSpanish ? "Jugar de nuevo" : "Play again";
  updateCertificatePreview();
}

function updateCertificatePrintSheet() {
  if (!certificatePrintSection) return;
  const isSpanish = currentLanguage === "es";
  certificatePrintName.textContent = certificateNameValue();
  certificatePrintDate.textContent = `${isSpanish ? "Fecha" : "Date"}: ${certificateDateValue()}`;
  document.querySelector("#certificate-sheet-kicker").textContent = isSpanish ? "Bobber, el perro de seguridad acuática" : "Bobber the Water Safety Dog";
  document.querySelector("#certificate-sheet-eyebrow").textContent = isSpanish ? "Certificado de valentía" : "Certificate of awesomeness";
  document.querySelector("#certificate-sheet-title").textContent = isSpanish ? "Héroe de seguridad" : "Safety Hero";
  document.querySelector("#certificate-sheet-copy").textContent = isSpanish ? "Esto certifica que" : "This certifies that";
  document.querySelector("#certificate-sheet-copy-two").textContent = isSpanish
    ? "completó el desafío de seguridad acuática de Bobber y está listo para un día seguro en el lago."
    : "completed Bobber’s water-safety challenge and is ready for a safe day at the lake.";
  document.querySelector("#certificate-sheet-signature-label").textContent = isSpanish ? "Bobber, el perro de seguridad acuática" : "Bobber the Water Safety Dog";
}

function openCertificateDialog() {
  if (!certificateDialog) return;
  updateCertificateLanguage();
  updateCertificatePreview();
  certificateDialog.showModal();
  certificateName.focus();
  certificateName.select();
}

function printCertificate() {
  if (!certificatePrintSection) return;
  updateCertificatePrintSheet();
  certificatePrintSection.setAttribute("aria-hidden", "false");
  document.body.classList.add("printing-certificate");
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("printing-certificate");
    certificatePrintSection.setAttribute("aria-hidden", "true");
  }, { once: true });
  window.print();
}

if (certificateDialog && gameCertificate) {
  gameCertificate.addEventListener("click", openCertificateDialog);
  document.querySelector("#certificate-close").addEventListener("click", () => certificateDialog.close());
  document.querySelector("#certificate-cancel").addEventListener("click", () => certificateDialog.close());
  document.querySelector("#certificate-print").addEventListener("click", printCertificate);
  certificateName.addEventListener("input", updateCertificatePreview);
  certificateDialog.addEventListener("click", (event) => {
    if (event.target === certificateDialog) certificateDialog.close();
  });
}

if (gameNext) {
  gameNext.addEventListener("click", () => {
    if (!gameState.answered) return;
    const finished = gameState.index === gameState.rounds.length - 1;
    if (finished) {
      gameState.done = true;
      burstConfetti(document.querySelector(".game-card"));
    } else {
      gameState.index += 1;
      gameState.answered = false;
      gameState.chosen = -1;
    }
    renderGame();
    if (finished) gameResult.focus();
    else gameQuestion.focus();
  });

  gameRestart.addEventListener("click", () => {
    startGame();
    renderGame();
    gameQuestion.focus();
  });

  startGame();
  renderGame();
}

// Cards and headings bounce in as they scroll into view. Skipped for reduced motion, and content stays visible without scripts.
const revealTargets = document.querySelectorAll(".section-heading, .safety-card, .visit-card, .educator-card, .video-card, .app-download, .ar-card");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  revealTargets.forEach((element) => element.classList.add("reveal"));
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  revealTargets.forEach((element) => revealObserver.observe(element));
}

setupPwa();
setLanguage(document.documentElement.dataset.locale === "es" ? "es" : "en");
