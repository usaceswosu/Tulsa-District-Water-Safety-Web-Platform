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
  if (!grid || !searchInput) return;
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

if (grid && searchInput) {
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

  for (const { node, original } of staticEnglishTextNodes) {
    if (!node.isConnected) continue;
    const text = original.trim();
    const translated = isSpanish ? spanishText[text] : undefined;
    node.nodeValue = translated ? original.replace(text, translated) : original;
  }

  const heroTitle = document.querySelector("#hero-title");
  if (heroTitle) {
    heroTitle.innerHTML = isSpanish
      ? "Disfruta del agua<br><span>con seguridad</span>."
      : "Big fun.<br><span>Water-safe</span> adventures.";
  }

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
  document.querySelector(".quick-strip")?.setAttribute("aria-label", isSpanish ? "Explora el sitio" : "Explore the site");
  document.querySelector(".filters")?.setAttribute("aria-label", isSpanish ? "Filtrar recursos" : "Filter resources");
  if (searchInput) {
    searchInput.setAttribute("aria-label", isSpanish ? "Buscar recursos de Bobber" : "Search Bobber resources");
    searchInput.placeholder = isSpanish ? "Buscar actividades, afiches y cuentos…" : "Search activities, posters, books…";
  }
  document.querySelector(".hero-feature")?.setAttribute("aria-label", isSpanish ? "Consejo de seguridad acuática de Bobber" : "Bobber’s water safety reminder");
  const noteImage = document.querySelector(".bobber-note img");
  if (noteImage) noteImage.alt = isSpanish ? "Bobber, el perro de seguridad acuática" : "Bobber the Water Safety Dog";

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
  if (infoClose) infoClose.setAttribute("aria-label", isSpanish ? "Cerrar" : "Close");
  if (infoDialog?.open) infoDialog.close();
  updateSpeechBubble();
  updateChecklist();
  renderGame();
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
  if (themeColor) themeColor.content = isDark ? "#101c20" : "#123c45";
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
  if (!easterDialog || easterDialog.open || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
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
// Bobber shares a different tip each day, and the lake-ready checklist celebrates a full set of ticks.
const dailyTips = [
  { en: "Wear your life jacket every time!", es: "¡Usa tu chaleco salvavidas siempre!" },
  { en: "Swim with a buddy!", es: "¡Nada acompañado!" },
  { en: "Reach or throw. Don’t go!", es: "¡Alcanza o lanza; no te metas!" },
  { en: "Cold water is sneaky—stay alert!", es: "El agua fría es traicionera: ¡mantente alerta!" },
  { en: "Ask a grown-up before you go!", es: "¡Pregunta a un adulto antes de ir!" },
  { en: "Look out for each other!", es: "¡Cuídense entre todos!" }
];
const speechBubble = document.querySelector(".speech-bubble");
const dailyTip = dailyTips[Math.floor(Date.now() / 86400000) % dailyTips.length];

function updateSpeechBubble() {
  if (speechBubble) speechBubble.textContent = currentLanguage === "es" ? dailyTip.es : dailyTip.en;
  if (readySay) readySay.textContent = currentLanguage === "es" ? "¡Marca cada uno!" : "Tick each one!";
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
  window.setTimeout(() => layer.remove(), 1800);
}

const readyBoxes = [...document.querySelectorAll(".lake-check-list input")];
let checklistDone = false;
const readyProgress = document.querySelector("#lake-check-progress");
const readyDone = document.querySelector("#lake-check-done");
const readyBobber = document.querySelector(".lake-check-bobber");
const readyBobberImg = document.querySelector("#lake-check-bobber-img");
const readySay = document.querySelector("#lake-check-say");
const reactions = [...document.querySelectorAll(".reaction")];
const bobberLooks = {
  bare: "assets/bobber/bobber-no-jacket.webp",
  jacket: "assets/bobber/bobber-sitting.png",
  buddy: "assets/bobber/bobber-buddy.webp"
};
Object.values(bobberLooks).forEach((src) => { const preload = new Image(); preload.src = src; });

// Bobber starts without his life jacket; ticking the boxes dresses him and adds his buddy.
function updateBobberLook() {
  if (!readyBobberImg) return;
  const jacketOn = Boolean(readyBoxes[0]?.checked);
  const buddyOn = Boolean(readyBoxes[1]?.checked);
  const next = buddyOn ? bobberLooks.buddy : jacketOn ? bobberLooks.jacket : bobberLooks.bare;
  if (readyBobberImg.getAttribute("src") !== next) readyBobberImg.src = next;
  readyBobber?.classList.toggle("is-buddy", buddyOn);
}

// Each tick makes Bobber react: he hops, and the matching prop pops in beside him.
const checklistReactions = [
  { say: { en: "Life jacket on! You look great.", es: "¡Chaleco puesto! Te ves muy bien." } },
  { say: { en: "Buddy by your side!", es: "¡Tu compañero está contigo!" } },
  { say: { en: "A grown-up is watching. Nice!", es: "Un adulto está vigilando. ¡Bien!" } },
  { say: { en: "Reach or throw, not go!", es: "¡Alcanza o lanza, no te metas!" } }
];

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

// Each pal opens their official 1-2-3 Splash trading card.
const palCards = {
  "Ranger Buck": {
    art: "assets/cards/splash/card-2.webp",
    page: 4,
    rule: { en: "Learn to swim and float well!", es: "¡Aprende a nadar y flotar bien!" }
  },
  "Ranger Jane": {
    art: "assets/cards/splash/card-3.webp",
    page: 5,
    rule: { en: "Get outdoors and play it safe!", es: "¡Disfruta al aire libre con seguridad!" }
  },
  "Ranger Toro": {
    art: "assets/cards/splash/card-4.webp",
    page: 6,
    rule: { en: "Learn to swim and float well!", es: "¡Aprenda a nadar y flotar bien!" }
  },
  "Corkey": {
    art: "assets/cards/splash/card-7.webp",
    page: 9,
    rule: { en: "Always swim with a buddy!", es: "¡Nada siempre acompañado!" }
  },
  "Sinker": {
    art: "assets/cards/splash/card-8.webp",
    page: 10,
    rule: { en: "Don’t trust inflatable toys!", es: "¡No confíes en los juguetes inflables!" }
  }
};

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
    }
  }
  infoDialog.showModal();
}

function makeCardOpen(container, getInfo) {
  if (!container || !infoDialog) return;
  container.tabIndex = 0;
  container.setAttribute("role", "button");
  container.setAttribute("aria-haspopup", "dialog");
  container.classList.add("is-clickable");
  const open = () => {
    const info = getInfo();
    if (info) openInfoCard(info);
  };
  container.addEventListener("click", open);
  container.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
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

// Bobber's safety game: four picture questions with instant feedback.
const gameQuestions = [
  {
    art: "assets/bobber/bobber-jacket-rack.webp",
    alt: { en: "Bobber next to a rack of life jackets", es: "Bobber junto a un perchero de chalecos salvavidas" },
    question: { en: "What should you put on before you get in a boat?", es: "¿Qué debes ponerte antes de subir a un bote?" },
    options: [
      { en: "A life jacket", es: "Un chaleco salvavidas", correct: true },
      { en: "A raincoat", es: "Un impermeable" },
      { en: "Sunglasses", es: "Gafas de sol" }
    ]
  },
  {
    art: "assets/bobber/bobber-lifebuoy.webp",
    alt: { en: "Bobber throwing a lifebuoy from a dock", es: "Bobber lanzando un salvavidas desde un muelle" },
    question: { en: "What should you do if someone is in trouble in the water?", es: "¿Qué debes hacer si alguien está en peligro en el agua?" },
    options: [
      { en: "Reach or throw something that floats", es: "Alcanzar o lanzar algo que flote", correct: true },
      { en: "Jump in to help", es: "Saltar al agua para ayudar" },
      { en: "Wait and do nothing", es: "Esperar sin hacer nada" }
    ]
  },
  {
    art: "assets/bobber/bobber-swim.webp",
    alt: { en: "Bobber swimming with a buddy", es: "Bobber nadando con un compañero" },
    question: { en: "Who should you swim with?", es: "¿Con quién debes nadar?" },
    options: [
      { en: "A buddy", es: "Con un compañero", correct: true },
      { en: "Nobody", es: "Con nadie" },
      { en: "A beach toy", es: "Con un juguete de playa" }
    ]
  },
  {
    art: "assets/bobber/bobber-boat.webp",
    alt: { en: "Bobber rowing a boat", es: "Bobber remando en un bote" },
    question: { en: "What should you check before a lake day?", es: "¿Qué debes revisar antes de un día en el lago?" },
    options: [
      { en: "The weather and water conditions", es: "El clima y las condiciones del agua", correct: true },
      { en: "Only the snack bag", es: "Solo la bolsa de bocadillos" },
      { en: "Nothing at all", es: "Nada" }
    ]
  }
];

const gameArt = document.querySelector("#game-art");
const gameQuestion = document.querySelector("#game-question");
const gameOptions = document.querySelector("#game-options");
const gameProgress = document.querySelector("#game-progress");
const gameFeedback = document.querySelector("#game-feedback");
const gameNext = document.querySelector("#game-next");
const gameNextLabel = document.querySelector("#game-next-label");
const gameResult = document.querySelector("#game-result");
const gameRestart = document.querySelector("#game-restart");
const gameState = { index: 0, score: 0, answered: false, chosen: -1, done: false };

function gameText(pair) {
  return currentLanguage === "es" ? pair.es : pair.en;
}

function renderGame() {
  if (!gameOptions) return;
  const total = gameQuestions.length;

  if (gameState.done) {
    gameProgress.textContent = "";
    gameQuestion.hidden = true;
    gameArt.hidden = true;
    gameOptions.replaceChildren();
    gameFeedback.textContent = "";
    gameNext.hidden = true;
    gameResult.hidden = false;
    gameResult.textContent = gameText({ en: `You got ${gameState.score} of ${total} right!`, es: `¡Acertaste ${gameState.score} de ${total}!` });
    gameRestart.hidden = false;
    return;
  }

  const round = gameQuestions[gameState.index];
  gameResult.hidden = true;
  gameRestart.hidden = true;
  gameQuestion.hidden = false;
  gameArt.hidden = false;
  gameProgress.textContent = gameText({ en: `Question ${gameState.index + 1} of ${total}`, es: `Pregunta ${gameState.index + 1} de ${total}` });
  gameQuestion.textContent = gameText(round.question);
  gameArt.src = round.art;
  gameArt.alt = gameText(round.alt);

  const correctIndex = round.options.findIndex((option) => option.correct);
  gameOptions.replaceChildren(...round.options.map((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "game-option";
    button.textContent = gameText(option);
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
      : gameText({ en: "Not quite. The safe answer is: ", es: "Casi. La respuesta segura es: " }) + gameText(round.options[correctIndex]);
    gameNextHidden();
  } else {
    gameFeedback.textContent = "";
    gameNext.hidden = true;
  }
}

function gameNextHidden() {
  gameNext.hidden = false;
  gameNextLabel.textContent = gameState.index === gameQuestions.length - 1
    ? gameText({ en: "See my score", es: "Ver mi resultado" })
    : gameText({ en: "Next question", es: "Siguiente pregunta" });
}

function chooseGameOption(index) {
  const correctIndex = gameQuestions[gameState.index].options.findIndex((option) => option.correct);
  gameState.answered = true;
  gameState.chosen = index;
  if (index === correctIndex) gameState.score += 1;
  renderGame();
  gameNext.focus();
}

if (gameNext) {
  gameNext.addEventListener("click", () => {
    if (!gameState.answered) return;
    if (gameState.index === gameQuestions.length - 1) {
      gameState.done = true;
      burstConfetti(document.querySelector(".game-card"));
    } else {
      gameState.index += 1;
      gameState.answered = false;
      gameState.chosen = -1;
    }
    renderGame();
    gameQuestion.focus();
  });

  gameRestart.addEventListener("click", () => {
    gameState.index = 0;
    gameState.score = 0;
    gameState.answered = false;
    gameState.chosen = -1;
    gameState.done = false;
    renderGame();
    gameQuestion.focus();
  });

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

setLanguage(document.documentElement.dataset.locale === "es" ? "es" : "en");
