// Browser-only enhancements for the static GitHub Pages site.
const resources = window.BOBBER_RESOURCES;
const categoryLabels = window.BOBBER_CATEGORY_LABELS;
const resourceTitlesEs = window.BOBBER_RESOURCE_TITLES_ES;
const spanishText = window.BOBBER_TRANSLATIONS_ES;
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

// Resource library: cards use local PDFs and previews from the repository.
function makeCard(resource) {
  const displayTitle = currentLanguage === "es" ? (resourceTitlesEs[resource.title] || resource.title) : resource.title;
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
  const link = document.createElement("a");
  link.className = "resource-link";
  link.href = assetPath(resource.file);
  link.target = "_blank";
  link.rel = "noopener";
  link.setAttribute("aria-label", currentLanguage === "es" ? `Abrir el PDF de ${displayTitle} en una pestaña nueva` : `Open ${resource.title} PDF in a new tab`);
  const linkLabel = document.createElement("span");
  linkLabel.textContent = currentLanguage === "es"
    ? (resource.category === "storybook" ? "Leer el cuento" : "Abrir PDF para imprimir")
    : (resource.category === "storybook" ? "Read the story" : "Open printable PDF");
  const arrow = document.createElement("span");
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = "↗";
  link.append(linkLabel, arrow);
  body.append(title, link);
  article.append(preview, body);
  return article;
}

function renderResources() {
  const query = searchInput.value.trim().toLocaleLowerCase();
  const visibleResources = resources.filter((resource) => {
    const matchesCategory = activeFilter === "all" || resource.category === activeFilter;
    const searchableTitle = currentLanguage === "es" ? `${resource.title} ${resourceTitlesEs[resource.title] || ""}` : resource.title;
    const matchesQuery = !query || searchableTitle.toLocaleLowerCase().includes(query);
    return matchesCategory && matchesQuery;
  });

  grid.replaceChildren(...visibleResources.map(makeCard));
  emptyState.hidden = visibleResources.length !== 0;
  resultsMessage.textContent = currentLanguage === "es"
    ? `${visibleResources.length} ${visibleResources.length === 1 ? "recurso" : "recursos"}${query ? ` para “${searchInput.value.trim()}”` : ""}`
    : `${visibleResources.length} ${visibleResources.length === 1 ? "resource" : "resources"}${query ? ` matching “${searchInput.value.trim()}”` : ""}`;
}

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
document.querySelector("#reset-search").addEventListener("click", () => {
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
document.querySelector("#count-all").textContent = resources.length;

const menuToggle = document.querySelector("#menu-toggle");
const siteNav = document.querySelector("#site-nav");
function menuButtonLabel(isOpen) {
  if (currentLanguage === "es") return isOpen ? "Cerrar el menú" : "Abrir el menú";
  return isOpen ? "Close navigation" : "Open navigation";
}

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
// Keyboard shortcuts for responsive navigation and the resource search.
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", menuButtonLabel(false));
    siteNav.classList.remove("is-open");
    menuToggle.focus();
  }
  if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

const headerLanguageToggle = document.querySelector("#header-language-toggle");
const spanishSafetyCopy = [...document.querySelectorAll(".spanish-copy")];
const englishSafetyCopy = [...document.querySelectorAll(".safety-card > p")];
function updateExternalLinkLabels() {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    if (link.hasAttribute("aria-label") && link.dataset.autoExternalLabel !== "true") return;
    const label = [...link.childNodes]
      .map((node) => node.nodeType === Node.ELEMENT_NODE && node.hasAttribute("aria-hidden") ? "" : node.textContent)
      .join(" ")
      .replace(/[↗→]\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) return;
    link.dataset.autoExternalLabel = "true";
    link.setAttribute("aria-label", currentLanguage === "es" ? `${label} (se abre en una pestaña nueva)` : `${label} (opens in a new tab)`);
  });
}

// Update visible copy, document language, and accessible labels together.
function setLanguage(language) {
  currentLanguage = language;
  const isSpanish = language === "es";
  document.documentElement.lang = language;
  document.documentElement.dataset.locale = language;
  savePreference("bobber-language", language);
  document.title = isSpanish ? "Bobber, el perro de seguridad acuática | Distrito de Tulsa, USACE" : "Bobber the Water Safety Dog | Tulsa District, USACE";
  document.querySelector('meta[name="description"]').content = isSpanish
    ? "Conoce a Bobber y encuentra consejos de seguridad acuática en español, dibujos animados y recursos para imprimir del Distrito de Tulsa del Cuerpo de Ingenieros del Ejército de EE. UU."
    : "Meet Bobber the Water Safety Dog. Explore family-friendly water safety videos, printable activities, posters, coloring sheets, and storybooks from the U.S. Army Corps of Engineers Tulsa District.";

  for (const { node, original } of staticEnglishTextNodes) {
    if (!node.isConnected) continue;
    const text = original.trim();
    const translated = isSpanish ? spanishText[text] : undefined;
    node.nodeValue = translated ? original.replace(text, translated) : original;
  }

  document.querySelector("#hero-title").innerHTML = isSpanish
    ? "Disfruta del agua<br><span>con seguridad</span>."
    : "Big fun.<br><span>Water-safe</span> adventures.";

  const languageCode = headerLanguageToggle.querySelector(".language-code");
  const languageName = headerLanguageToggle.querySelector(".language-name");
  languageCode.textContent = isSpanish ? "EN" : "ES";
  languageName.textContent = isSpanish ? "Inglés" : "Español";
  languageName.lang = "es";
  headerLanguageToggle.setAttribute("aria-pressed", String(isSpanish));
  headerLanguageToggle.setAttribute("aria-label", isSpanish ? "Cambiar el sitio a inglés / Switch to English" : "Switch the entire page to Spanish / Cambiar a español");
  headerLanguageToggle.title = isSpanish ? "Cambiar el sitio a inglés / Switch to English" : "Switch the entire page to Spanish / Cambiar a español";

  menuToggle.setAttribute("aria-label", menuButtonLabel(menuToggle.getAttribute("aria-expanded") === "true"));
  siteNav.setAttribute("aria-label", isSpanish ? "Navegación principal" : "Main navigation");
  document.querySelector(".skip-link").setAttribute("aria-label", isSpanish ? "Saltar al contenido" : "Skip to content");
  document.querySelector(".brand").setAttribute("aria-label", isSpanish ? "Inicio de Bobber, el perro de seguridad acuática" : "Bobber water safety home");
  document.querySelector(".quick-strip").setAttribute("aria-label", isSpanish ? "Explora el sitio" : "Explore the site");
  document.querySelector(".filters").setAttribute("aria-label", isSpanish ? "Filtrar recursos" : "Filter resources");
  document.querySelector("#resource-search").setAttribute("aria-label", isSpanish ? "Buscar recursos de Bobber" : "Search Bobber resources");
  document.querySelector("#resource-search").placeholder = isSpanish ? "Buscar actividades, afiches y cuentos…" : "Search activities, posters, books…";
  document.querySelector(".hero-feature").setAttribute("aria-label", isSpanish ? "Consejo de seguridad acuática de Bobber" : "Bobber’s water safety reminder");
  document.querySelector(".bobber-note img").alt = isSpanish ? "Bobber, el perro de seguridad acuática, con Ranger Buck" : "Bobber the Water Safety Dog with Ranger Buck";

  englishSafetyCopy.forEach((copy) => { copy.hidden = isSpanish; });
  spanishSafetyCopy.forEach((copy) => { copy.hidden = !isSpanish; });
  spanishSafetyCopy.forEach((copy) => {
    const label = copy.querySelector(":scope > span");
    if (label) label.textContent = isSpanish ? "BORRADOR · TRADUCCIÓN" : "ESPAÑOL · BORRADOR";
  });

  filterButtons.forEach((button) => {
    const key = button.dataset.filter;
    const label = button.querySelector("span");
    if (label) {
      button.firstChild.textContent = `${categoryLabels[language][key]} `;
    } else {
      button.textContent = categoryLabels[language][key];
    }
  });
  renderResources();
  updateThemeControl();
  updateExternalLinkLabels();
  updateEasterDialogLanguage();
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
  document.querySelector('meta[name="theme-color"]').content = isDark ? "#101c20" : "#123c45";
}

// Hidden Konami-code easter egg.
const easterDialog = document.querySelector("#easter-dialog");
const easterConfetti = document.querySelector("#easter-confetti");
function updateEasterDialogLanguage() {
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

document.querySelector("#easter-close").addEventListener("click", () => easterDialog.close());
document.querySelector("#easter-return").addEventListener("click", () => easterDialog.close());
easterDialog.addEventListener("click", (event) => {
  if (event.target === easterDialog) easterDialog.close();
});

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
  if (easterDialog.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
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
setLanguage(document.documentElement.dataset.locale === "es" ? "es" : "en");
