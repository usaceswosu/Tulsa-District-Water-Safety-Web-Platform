/*
 * In-page PDF reader.
 *
 * Loaded before scripts/main.js on both pages. It exposes openPdfReader(),
 * prefetchPdfEngine(), and updatePdfReaderLanguage() to the page controller.
 *
 * Session rule: every async continuation checks `activePdf === session` before
 * touching the DOM. Closing, reopening, or falling back invalidates the old
 * session so a late PDF.js callback cannot overwrite the current document.
 */
const pdfReader = document.querySelector("#pdf-reader");
const pdfReaderTitle = document.querySelector("#pdf-reader-title");
const pdfReaderClose = document.querySelector("#pdf-reader-close");
const pdfReaderDownload = document.querySelector("#pdf-reader-download");
const pdfReaderPrintFull = document.querySelector("#pdf-reader-print-full");
const pdfReaderPrintPage = document.querySelector("#pdf-reader-print-page");
const pdfPrintPage = document.querySelector("#pdf-print-page");
const pdfReaderStage = document.querySelector("#pdf-reader-stage");
const pdfReaderStatus = document.querySelector("#pdf-reader-status");
const pdfReaderPrevious = document.querySelector("#pdf-reader-prev");
const pdfReaderNext = document.querySelector("#pdf-reader-next");
const pdfReaderToolbar = document.querySelector(".pdf-reader-toolbar");
const pdfReaderZoomLabel = document.querySelector("#pdf-reader-zoom-label");
const pdfReaderZoomOut = document.querySelector("#pdf-reader-zoom-out");
const pdfReaderZoomIn = document.querySelector("#pdf-reader-zoom-in");
const pdfReaderZoomReset = document.querySelector("#pdf-reader-zoom-reset");
const pdfReaderZoomValue = document.querySelector("#pdf-reader-zoom-value");
const pdfReaderJump = document.querySelector("#pdf-reader-jump");
const pdfReaderPageInput = document.querySelector("#pdf-reader-page-input");
const pdfReaderPageLabel = document.querySelector("#pdf-reader-page-label");
const pdfReaderPageOf = document.querySelector("#pdf-reader-page-of");
const pdfReaderPageTotal = document.querySelector("#pdf-reader-page-total");
const pdfReaderGo = document.querySelector("#pdf-reader-go");
const pdfReaderTocToggle = document.querySelector("#pdf-reader-toc-toggle");
const pdfReaderToc = document.querySelector("#pdf-reader-toc");
const pdfReaderTocTitle = document.querySelector("#pdf-reader-toc-title");
const pdfReaderTocList = document.querySelector("#pdf-reader-toc-list");
const PDF_ZOOM_LEVELS = [0.75, 1, 1.25, 1.5, 2];
const PDF_LOAD_TIMEOUT_MS = 7000;
const TOC_MIN_ITEMS = 3;
const STAGE_INSET_PX = 16;
const MIN_STAGE_SPACE_PX = 120;
const MAX_DPR = 2;
const MIN_RENDER_SCALE = 0.1;
const MAX_RENDER_SCALE = 4;
const PRINT_MAX_EDGE_PX = 2550;
const PRINT_CLEANUP_FALLBACK_MS = 300_000;

/**
 * @typedef {Object} ReaderSession
 * @property {string} title
 * @property {string} url fast preview used by the canvas reader
 * @property {string} downloadUrl full print-quality PDF
 * @property {boolean} preview
 * @property {string} placeholder first-page thumbnail
 * @property {HTMLElement} opener link that opened the reader
 * @property {number} page 0 until the first page finishes rendering
 * @property {boolean} fallback true when the browser iframe owns rendering
 * @property {number} zoom
 * @property {Array<{ title: string, page: number | null, depth: number }>} toc
 * @property {number} [watchdog]
 * @property {Object} [document] PDF.js document proxy
 * @property {Object} [loadingTask]
 * @property {Object} [renderTask]
 * @property {boolean} [rendering]
 * @property {boolean} [needsResize]
 */

const readerScript = document.currentScript;
const pdfEngine = new URL("../vendor/pdfjs/", readerScript.src);
const readerAssetVersion = new URL(readerScript.src).searchParams.get("v") || "";
const vendorQuery = readerAssetVersion ? `?v=${encodeURIComponent(readerAssetVersion)}` : "";
const pdfModuleUrl = new URL(`build/pdf.min.mjs${vendorQuery}`, pdfEngine);
const pdfWorkerUrl = new URL(`build/pdf.worker.min.mjs${vendorQuery}`, pdfEngine);
let activePdf;
let pdfjsPromise;
let printInProgress = false;
let printCleanupTimer;

// Load PDF.js once. A rejected attempt clears the cached promise so the next
// click can retry instead of falling back forever.
function loadPdfEngine() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(pdfModuleUrl).then((module) => {
      try {
        fetch(pdfWorkerUrl, { cache: "force-cache" }).catch(() => {});
      } catch {
        // The worker will still load on first use.
      }
      return module;
    });
    // A failed import must not poison later attempts to open a PDF.
    pdfjsPromise.catch(() => { pdfjsPromise = undefined; });
  }
  return pdfjsPromise;
}

// Warm the reader on first hover or focus so the first PDF opens quickly.
function prefetchPdfEngine() {
  const connection = navigator.connection;
  const effectiveType = connection?.effectiveType || "";
  if (connection?.saveData || /(^|-)2g$|^3g$/.test(effectiveType)) return;
  loadPdfEngine().catch(() => {});
}
window.prefetchPdfEngine = prefetchPdfEngine;

function readerCopy(english, spanish) {
  return document.documentElement.lang === "es" ? spanish : english;
}

function setPdfControls(documentProxy, page) {
  pdfReaderPrevious.setAttribute("aria-disabled", String(!documentProxy || page <= 1));
  pdfReaderNext.setAttribute("aria-disabled", String(!documentProxy || page >= documentProxy.numPages));
}

function updateTocVisibility(session) {
  const available = Boolean(session?.document && !session.fallback && session.toc?.length >= TOC_MIN_ITEMS);
  pdfReaderTocToggle.hidden = !available;
  if (!available) {
    pdfReaderToc.hidden = true;
    pdfReaderTocToggle.setAttribute("aria-expanded", "false");
  }
}

function updateReaderTools(session, page = 1) {
  if (!pdfReaderToolbar) return;
  const ready = Boolean(session?.document && !session.fallback);
  pdfReaderToolbar.hidden = !ready;
  if (!ready) {
    updateTocVisibility(session);
    return;
  }
  const zoom = session.zoom || 1;
  const zoomIndex = PDF_ZOOM_LEVELS.findIndex((level) => Math.abs(level - zoom) < 0.001);
  const busy = Boolean(session.rendering);
  pdfReaderZoomValue.textContent = `${Math.round(zoom * 100)}%`;
  pdfReaderZoomOut.disabled = busy || zoomIndex <= 0;
  pdfReaderZoomIn.disabled = busy || zoomIndex === PDF_ZOOM_LEVELS.length - 1;
  pdfReaderZoomReset.disabled = busy || zoomIndex === 1;
  pdfReaderPageInput.disabled = busy;
  pdfReaderGo.disabled = busy;
  pdfReaderPrintPage.disabled = busy || !session.page;
  pdfReaderPageInput.max = String(session.document.numPages);
  pdfReaderPageInput.value = String(Math.min(Math.max(1, page || session.page || 1), session.document.numPages));
  pdfReaderPageTotal.textContent = String(session.document.numPages);
  updateTocVisibility(session);
}

function showReaderToolsLoading() {
  pdfReaderToolbar.hidden = false;
  pdfReaderZoomOut.disabled = true;
  pdfReaderZoomIn.disabled = true;
  pdfReaderZoomReset.disabled = true;
  pdfReaderPageInput.disabled = true;
  pdfReaderGo.disabled = true;
  pdfReaderPrintPage.disabled = true;
  pdfReaderPageInput.value = "1";
  pdfReaderPageInput.max = "1";
  pdfReaderPageTotal.textContent = "1";
  pdfReaderZoomValue.textContent = "100%";
  pdfReaderToc.hidden = true;
  pdfReaderTocToggle.hidden = true;
  pdfReaderTocToggle.setAttribute("aria-expanded", "false");
}

function stepPdfZoom(direction) {
  if (!activePdf?.document || activePdf.fallback || activePdf.rendering) return;
  const current = activePdf.zoom || 1;
  const index = PDF_ZOOM_LEVELS.findIndex((level) => Math.abs(level - current) < 0.001);
  const nextIndex = Math.min(PDF_ZOOM_LEVELS.length - 1, Math.max(0, index + direction));
  const next = PDF_ZOOM_LEVELS[nextIndex];
  if (next === current) return;
  activePdf.zoom = next;
  if (activePdf.page) showPdfPage(activePdf, activePdf.page);
  else updateReaderTools(activePdf, 1);
}

function resetPdfZoom() {
  if (!activePdf?.document || activePdf.fallback || activePdf.rendering) return;
  if ((activePdf.zoom || 1) === 1) return;
  activePdf.zoom = 1;
  if (activePdf.page) showPdfPage(activePdf, activePdf.page);
  else updateReaderTools(activePdf, 1);
}

// If the scripted reader cannot start, fall back to the browser's own PDF viewer.
function showPdfFallback(session) {
  if (!session || activePdf !== session || session.fallback) return;
  window.clearTimeout(session.watchdog);
  session.fallback = true;
  try { session.loadingTask?.destroy()?.catch?.(() => {}); } catch { /* already gone */ }
  setPdfControls(null);
  pdfReaderToolbar.hidden = true;
  updateTocVisibility(session);
  pdfReaderPrintPage.disabled = true;
  pdfReaderPrevious.hidden = true;
  pdfReaderNext.hidden = true;
  const frame = document.createElement("iframe");
  frame.className = "pdf-reader-frame";
  frame.src = session.url;
  frame.title = `${session.title} PDF`;
  pdfReaderStage.replaceChildren(frame);
  pdfReaderStatus.textContent = readerCopy(
    "Showing this PDF in your browser’s viewer. You can also download it.",
    "Mostrando este PDF en el visor de tu navegador. También puedes descargarlo."
  );
}

async function showPdfPage(session, pageNumber) {
  if (activePdf !== session || session.fallback || session.rendering) return;
  session.rendering = true;
  setPdfControls(null);
  updateReaderTools(session, pageNumber);
  pdfReaderStatus.textContent = readerCopy("Loading page…", "Cargando página…");
  try {
    const page = await session.document.getPage(pageNumber);
    if (activePdf !== session || session.fallback) return;
    const natural = page.getViewport({ scale: 1 });
    const stage = pdfReaderStage.getBoundingClientRect();
    const availableWidth = Math.max(MIN_STAGE_SPACE_PX, stage.width - STAGE_INSET_PX);
    const availableHeight = Math.max(MIN_STAGE_SPACE_PX, stage.height - STAGE_INSET_PX);
    const fit = Math.min(availableWidth / natural.width, availableHeight / natural.height);
    const zoom = session.zoom || 1;
    const displayWidth = natural.width * fit * zoom;
    const displayHeight = natural.height * fit * zoom;
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const renderScale = Math.max(MIN_RENDER_SCALE, Math.min(MAX_RENDER_SCALE, (displayWidth * dpr) / natural.width));
    const viewport = page.getViewport({ scale: renderScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    canvas.setAttribute("role", "img");
    const label = readerCopy(
      `Page ${pageNumber} of ${session.document.numPages}`,
      `Página ${pageNumber} de ${session.document.numPages}`
    );
    canvas.setAttribute("aria-label", `${session.title} — ${label}`);
    session.renderTask = page.render({ canvas, viewport });
    await session.renderTask.promise;
    if (activePdf !== session || session.fallback) return;
    session.page = pageNumber;
    window.clearTimeout(session.watchdog);
    pdfReaderStage.replaceChildren(canvas);
    pdfReaderStage.scrollTo({ top: 0, left: 0 });
    pdfReaderStatus.textContent = label;
  } catch {
    if (activePdf === session) showPdfFallback(session);
  } finally {
    session.renderTask = null;
    session.rendering = false;
    if (activePdf === session && session.page && !session.fallback) {
      setPdfControls(session.document, session.page);
      updateReaderTools(session, session.page);
      if (session.needsResize) {
        session.needsResize = false;
        showPdfPage(session, session.page);
      }
    }
  }
}

function updateReaderChrome() {
  pdfReaderClose.textContent = readerCopy("Back to the library", "Volver a la biblioteca");
  pdfReaderDownload.textContent = activePdf?.preview
    ? readerCopy("Download print PDF", "Descargar PDF para imprimir")
    : readerCopy("Download PDF", "Descargar PDF");
  pdfReaderDownload.title = activePdf?.preview
    ? readerCopy("Full print-quality PDF", "PDF de calidad para imprimir")
    : "";
  pdfReaderPrintFull.textContent = readerCopy("Print full PDF", "Imprimir PDF completo");
  pdfReaderPrintFull.title = readerCopy(
    "Open the full print-quality PDF in a new tab to print",
    "Abre el PDF completo de calidad para imprimir en una pestaña nueva"
  );
  pdfReaderPrintFull.href = activePdf?.downloadUrl || activePdf?.url || "#";
  pdfReaderPrintPage.textContent = readerCopy("Print this page", "Imprimir esta página");
  pdfReaderPrintPage.title = readerCopy("Print the page you are viewing", "Imprime la página que estás viendo");
  const placeholderImage = pdfReaderStage.querySelector(".pdf-reader-placeholder");
  if (placeholderImage) {
    placeholderImage.alt = readerCopy(
      `First page preview: ${activePdf?.title || ""}`,
      `Vista previa de la primera página: ${activePdf?.title || ""}`
    );
  }
  const stageCanvas = pdfReaderStage.querySelector("canvas");
  if (stageCanvas && activePdf?.page) {
    const pageLabel = readerCopy(
      `Page ${activePdf.page} of ${activePdf.document.numPages}`,
      `Página ${activePdf.page} de ${activePdf.document.numPages}`
    );
    stageCanvas.setAttribute("aria-label", `${activePdf.title} — ${pageLabel}`);
  }
  const fallbackFrame = pdfReaderStage.querySelector("iframe");
  if (fallbackFrame) fallbackFrame.title = `${activePdf?.title || ""} PDF`;
  pdfReaderPrevious.textContent = readerCopy("Previous page", "Página anterior");
  pdfReaderNext.textContent = readerCopy("Next page", "Página siguiente");
  pdfReaderZoomLabel.textContent = readerCopy("Zoom", "Zoom");
  pdfReaderZoomOut.setAttribute("aria-label", readerCopy("Zoom out", "Alejar"));
  pdfReaderZoomIn.setAttribute("aria-label", readerCopy("Zoom in", "Acercar"));
  pdfReaderZoomReset.textContent = readerCopy("Fit", "Ajustar");
  pdfReaderPageLabel.textContent = readerCopy("Page", "Página");
  pdfReaderPageOf.textContent = readerCopy("of", "de");
  pdfReaderPageInput.setAttribute("aria-label", readerCopy("Page number", "Número de página"));
  pdfReaderGo.textContent = readerCopy("Go", "Ir");
  pdfReaderTocToggle.textContent = readerCopy("Contents", "Contenido");
  pdfReaderTocTitle.textContent = readerCopy("Contents", "Contenido");
  updateReaderTools(activePdf, activePdf?.page || 1);
  if (activePdf?.fallback) {
    pdfReaderStatus.textContent = readerCopy(
      "Showing this PDF in your browser’s viewer. You can also download it.",
      "Mostrando este PDF en el visor de tu navegador. También puedes descargarlo."
    );
  } else if (activePdf?.page) {
    pdfReaderStatus.textContent = readerCopy(
      `Page ${activePdf.page} of ${activePdf.document.numPages}`,
      `Página ${activePdf.page} de ${activePdf.document.numPages}`
    );
  }
}

// The page language can change while the reader is open.
window.updatePdfReaderLanguage = updateReaderChrome;

// Restore the reader after a print snapshot. Called by afterprint, a long
// fallback timer, close, and error paths; it is intentionally idempotent.
function cleanupPrintPage() {
  window.clearTimeout(printCleanupTimer);
  printCleanupTimer = undefined;
  printInProgress = false;
  document.body.classList.remove("printing-reader-page");
  pdfPrintPage?.setAttribute("aria-hidden", "true");
  pdfPrintPage?.replaceChildren();
  if (activePdf?.page) {
    pdfReaderStatus.textContent = readerCopy(
      `Page ${activePdf.page} of ${activePdf.document.numPages}`,
      `Página ${activePdf.page} de ${activePdf.document.numPages}`
    );
    updateReaderTools(activePdf, activePdf.page);
  } else if (activePdf) {
    pdfReaderPrintPage.disabled = true;
  }
}

async function printCurrentPage() {
  const session = activePdf;
  if (!session?.document || !session.page || session.rendering || session.fallback || printInProgress) return;
  printInProgress = true;
  pdfReaderPrintPage.disabled = true;
  pdfReaderStatus.textContent = readerCopy("Preparing the print view…", "Preparando la vista de impresión…");
  try {
    const page = await session.document.getPage(session.page);
    if (activePdf !== session || !pdfReader.open || session.fallback) {
      printInProgress = false;
      if (activePdf === session && !session.fallback) pdfReaderPrintPage.disabled = false;
      return;
    }
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_RENDER_SCALE, PRINT_MAX_EDGE_PX / Math.max(natural.width, natural.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    if (activePdf !== session || !pdfReader.open || session.fallback) {
      printInProgress = false;
      if (activePdf === session && !session.fallback) pdfReaderPrintPage.disabled = false;
      return;
    }
    pdfPrintPage.replaceChildren(canvas);
    pdfPrintPage.setAttribute("aria-hidden", "false");
    document.body.classList.add("printing-reader-page");
    window.addEventListener("afterprint", () => cleanupPrintPage(), { once: true });
    printCleanupTimer = window.setTimeout(cleanupPrintPage, PRINT_CLEANUP_FALLBACK_MS);
    window.print();
  } catch {
    cleanupPrintPage();
    pdfReaderPrintPage.disabled = false;
    pdfReaderStatus.textContent = readerCopy("Could not prepare the print view. Use Print full PDF.", "No se pudo preparar la vista de impresión. Usa Imprimir PDF completo.");
  }
}

async function outlinePage(session, destination) {
  let dest = destination;
  if (typeof dest === "string") dest = await session.document.getDestination(dest);
  if (!Array.isArray(dest) || !dest.length) return null;
  try {
    if (typeof dest[0] === "number") return dest[0] + 1;
    return (await session.document.getPageIndex(dest[0])) + 1;
  } catch {
    return null;
  }
}

function cleanTocTitle(title) {
  const value = String(title || "").trim();
  if (!value.includes("_")) return value;
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function collectToc(session, nodes, depth, output) {
  for (const node of nodes || []) {
    output.push({ title: cleanTocTitle(node.title), page: await outlinePage(session, node.dest), depth });
    if (node.items?.length) await collectToc(session, node.items, depth + 1, output);
  }
}

async function buildToc(session) {
  try {
    const outline = await session.document.getOutline();
    const items = [];
    if (outline?.length) await collectToc(session, outline, 0, items);
    if (activePdf !== session) return;
    session.toc = items.filter((item) => item.title);
    // TOC entries are built in the background after the first page is shown.
    // Keep the page input and zoom controls untouched while the user reads.
    pdfReaderTocList.replaceChildren(...session.toc.map((item) => {
      const entry = document.createElement("li");
      if (item.page) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pdf-reader-toc-link";
        button.dataset.depth = String(item.depth);
        button.textContent = item.title;
        const page = document.createElement("span");
        page.textContent = String(item.page);
        button.append(page);
        button.addEventListener("click", () => {
          showPdfPage(session, item.page);
          pdfReaderToc.hidden = true;
          pdfReaderTocToggle.setAttribute("aria-expanded", "false");
          pdfReaderTocToggle.focus();
        });
        entry.append(button);
      } else {
        const label = document.createElement("span");
        label.className = "pdf-reader-toc-label";
        label.dataset.depth = String(item.depth);
        label.textContent = item.title;
        entry.append(label);
      }
      return entry;
    }));
    updateTocVisibility(session);
  } catch {
    if (activePdf === session) {
      session.toc = [];
      updateTocVisibility(session);
    }
  }
}

// Stop PDF.js work for a session. The caller decides whether to clear the DOM
// and move focus (normal close) or replace it (switching documents).
function destroyPdfSession(session) {
  if (!session) return;
  window.clearTimeout(session.watchdog);
  try { session.renderTask?.cancel(); } catch { /* already gone */ }
  try { session.loadingTask?.destroy()?.catch?.(() => {}); } catch { /* already gone */ }
}

/**
 * Open a PDF in the dialog. Repeated calls replace the current session safely.
 * @param {string} url fast preview used by the canvas reader
 * @param {string} title display title
 * @param {HTMLElement} opener link that should regain focus on close
 * @param {string} [downloadUrl] full print-quality PDF
 * @param {boolean} [preview] true when url is a lightweight preview
 * @param {string} [placeholder] first-page thumbnail URL
 */
async function openPdfReader(url, title, opener, downloadUrl = url, preview = false, placeholder = "") {
  if (printInProgress || document.body.classList.contains("printing-reader-page")) cleanupPrintPage();
  if (activePdf) destroyPdfSession(activePdf);
  /** @type {ReaderSession} */
  const session = { title, url, downloadUrl, preview, placeholder, opener, page: 0, fallback: false, zoom: 1, toc: [] };
  activePdf = session;
  pdfReaderTitle.textContent = title;
  updateReaderChrome();
  pdfReaderDownload.href = session.downloadUrl;
  pdfReaderDownload.setAttribute("download", "");
  pdfReaderStage.replaceChildren();
  if (placeholder) {
    const image = document.createElement("img");
    image.className = "pdf-reader-placeholder";
    image.src = placeholder;
    image.alt = readerCopy(`First page preview: ${title}`, `Vista previa de la primera página: ${title}`);
    pdfReaderStage.append(image);
  }
  pdfReaderTocList.replaceChildren();
  pdfReaderToc.hidden = true;
  pdfReaderTocToggle.setAttribute("aria-expanded", "false");
  pdfReaderTocToggle.hidden = true;
  showReaderToolsLoading();
  pdfReaderStatus.textContent = readerCopy("Loading PDF…", "Cargando PDF…");
  setPdfControls(null);
  pdfReaderPrevious.hidden = false;
  pdfReaderNext.hidden = false;
  if (!pdfReader.open) pdfReader.showModal();
  session.watchdog = window.setTimeout(() => {
    if (activePdf === session && !session.page) showPdfFallback(session);
  }, PDF_LOAD_TIMEOUT_MS);

  try {
    const pdfjs = await loadPdfEngine();
    if (activePdf !== session) return;
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl.href;
    session.loadingTask = pdfjs.getDocument({
      url,
      standardFontDataUrl: new URL("web/standard_fonts/", pdfEngine).href,
      wasmUrl: new URL("web/wasm/", pdfEngine).href,
      iccUrl: new URL("web/iccs/", pdfEngine).href,
      isEvalSupported: false,
    });
    session.document = await session.loadingTask.promise;
    // Show the first page before extracting the outline so long guides are readable immediately.
    await showPdfPage(session, 1);
    if (activePdf === session && !session.fallback) buildToc(session);
  } catch {
    if (activePdf === session) showPdfFallback(session);
  }
}

function stepPdfPage(direction) {
  const button = direction < 0 ? pdfReaderPrevious : pdfReaderNext;
  if (button.getAttribute("aria-disabled") === "false") {
    showPdfPage(activePdf, (activePdf.page || 1) + direction);
  }
}

pdfReaderPrevious.addEventListener("click", () => stepPdfPage(-1));
pdfReaderNext.addEventListener("click", () => stepPdfPage(1));
pdfReaderZoomOut.addEventListener("click", () => stepPdfZoom(-1));
pdfReaderZoomIn.addEventListener("click", () => stepPdfZoom(1));
pdfReaderZoomReset.addEventListener("click", resetPdfZoom);
pdfReaderPrintPage.addEventListener("click", printCurrentPage);
pdfReaderPrintFull.addEventListener("click", () => {
  if (!activePdf) return;
  pdfReaderStatus.textContent = readerCopy(
    "The full PDF opened in a new tab. Use your viewer’s print button.",
    "El PDF completo se abrió en una pestaña nueva. Usa el botón de imprimir del visor."
  );
});
pdfReaderJump.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!activePdf?.document || activePdf.fallback || activePdf.rendering) return;
  const page = Number(pdfReaderPageInput.value);
  if (!Number.isInteger(page) || page < 1 || page > activePdf.document.numPages) {
    updateReaderTools(activePdf, activePdf.page || 1);
    return;
  }
  showPdfPage(activePdf, page);
});
pdfReaderTocToggle.addEventListener("click", () => {
  const open = pdfReaderToc.hidden;
  pdfReaderToc.hidden = !open;
  pdfReaderTocToggle.setAttribute("aria-expanded", String(open));
  if (open) pdfReaderToc.querySelector(".pdf-reader-toc-link")?.focus();
});

let readerResizeTimer;
window.addEventListener("resize", () => {
  if (!activePdf?.document || activePdf.fallback || !activePdf.page) return;
  activePdf.needsResize = true;
  window.clearTimeout(readerResizeTimer);
  readerResizeTimer = window.setTimeout(() => {
    if (!activePdf?.document || activePdf.fallback || !activePdf.page || activePdf.rendering) return;
    activePdf.needsResize = false;
    showPdfPage(activePdf, activePdf.page);
  }, 150);
});
pdfReaderClose.addEventListener("click", () => pdfReader.close());
pdfReader.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const target = event.target;
  if (target instanceof Element && target.closest("input, textarea, select, [contenteditable='true']")) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    stepPdfPage(event.key === "ArrowLeft" ? -1 : 1);
  }
});
pdfReader.addEventListener("close", () => {
  // A close event can arrive after a rapid close-and-reopen. Leave the new
  // session alone; the old one was already destroyed when the new one opened.
  if (pdfReader.open) return;
  const session = activePdf;
  activePdf = null;
  cleanupPrintPage();
  destroyPdfSession(session);
  pdfReaderStage.replaceChildren();
  session?.opener?.focus?.({ preventScroll: true });
});
