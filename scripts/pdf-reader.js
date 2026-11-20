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

const pdfEngine = new URL("../vendor/pdfjs/", document.currentScript.src);
let activePdf;
let pdfjsPromise;

// Warm the reader on first hover or focus so the first PDF opens quickly.
function prefetchPdfEngine() {
  if (navigator.connection?.saveData) return;
  pdfjsPromise ||= import(new URL("build/pdf.min.mjs", pdfEngine));
}
window.prefetchPdfEngine = prefetchPdfEngine;

function readerCopy(english, spanish) {
  return document.documentElement.lang === "es" ? spanish : english;
}

function setPdfControls(documentProxy, page) {
  pdfReaderPrevious.setAttribute("aria-disabled", String(!documentProxy || page <= 1));
  pdfReaderNext.setAttribute("aria-disabled", String(!documentProxy || page >= documentProxy.numPages));
}

function updateReaderTools(session, page = 1) {
  if (!pdfReaderToolbar) return;
  const ready = Boolean(session?.document && !session.fallback);
  pdfReaderToolbar.hidden = !ready;
  if (!ready) {
    pdfReaderToc.hidden = true;
    pdfReaderTocToggle.hidden = true;
    pdfReaderTocToggle.setAttribute("aria-expanded", "false");
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
  pdfReaderTocToggle.hidden = !(session.toc && session.toc.length >= 3);
  if (pdfReaderTocToggle.hidden) {
    pdfReaderToc.hidden = true;
    pdfReaderTocToggle.setAttribute("aria-expanded", "false");
  }
}

function showReaderToolsLoading() {
  pdfReaderToolbar.hidden = false;
  pdfReaderZoomOut.disabled = true;
  pdfReaderZoomIn.disabled = true;
  pdfReaderZoomReset.disabled = true;
  pdfReaderPageInput.disabled = true;
  pdfReaderGo.disabled = true;
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
  if (!session || activePdf !== session) return;
  window.clearTimeout(session.watchdog);
  session.fallback = true;
  try { session.loadingTask?.destroy(); } catch { /* already gone */ }
  setPdfControls(null);
  pdfReaderToolbar.hidden = true;
  pdfReaderToc.hidden = true;
  pdfReaderTocToggle.setAttribute("aria-expanded", "false");
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
  if (activePdf !== session || session.rendering) return;
  session.rendering = true;
  setPdfControls(null);
  updateReaderTools(session, pageNumber);
  pdfReaderStatus.textContent = readerCopy("Loading page…", "Cargando página…");
  try {
    const page = await session.document.getPage(pageNumber);
    if (activePdf !== session) return;
    const natural = page.getViewport({ scale: 1 });
    const stage = pdfReaderStage.getBoundingClientRect();
    const availableWidth = Math.max(120, stage.width - 16);
    const availableHeight = Math.max(120, stage.height - 16);
    const fit = Math.min(availableWidth / natural.width, availableHeight / natural.height);
    const zoom = session.zoom || 1;
    const displayWidth = natural.width * fit * zoom;
    const displayHeight = natural.height * fit * zoom;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const renderScale = Math.max(0.1, Math.min(4, (displayWidth * dpr) / natural.width));
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
    if (activePdf !== session) return;
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
    if (activePdf === session && session.page) {
      setPdfControls(session.document, session.page);
      updateReaderTools(session, session.page);
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

function cleanupPrintPage() {
  document.body.classList.remove("printing-reader-page");
  pdfPrintPage?.setAttribute("aria-hidden", "true");
  pdfPrintPage?.replaceChildren();
  if (activePdf?.page) {
    pdfReaderStatus.textContent = readerCopy(
      `Page ${activePdf.page} of ${activePdf.document.numPages}`,
      `Página ${activePdf.page} de ${activePdf.document.numPages}`
    );
    updateReaderTools(activePdf, activePdf.page);
  }
}

async function printCurrentPage() {
  if (!activePdf?.document || !activePdf.page || activePdf.rendering || activePdf.fallback) return;
  pdfReaderPrintPage.disabled = true;
  pdfReaderStatus.textContent = readerCopy("Preparing the print view…", "Preparando la vista de impresión…");
  try {
    const page = await activePdf.document.getPage(activePdf.page);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(4, 2550 / Math.max(natural.width, natural.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    await page.render({ canvas, viewport }).promise;
    pdfPrintPage.replaceChildren(canvas);
    pdfPrintPage.setAttribute("aria-hidden", "false");
    document.body.classList.add("printing-reader-page");
    window.print();
    cleanupPrintPage();
  } catch {
    pdfReaderStatus.textContent = readerCopy("Could not prepare the print view. Use Print full PDF.", "No se pudo preparar la vista de impresión. Usa Imprimir PDF completo.");
    pdfReaderPrintPage.disabled = false;
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
    updateReaderTools(session, session.page || 1);
  } catch {
    if (activePdf === session) {
      session.toc = [];
      updateReaderTools(session, session.page || 1);
    }
  }
}

async function openPdfReader(url, title, opener, downloadUrl = url, preview = false) {
  // `url` is the fast preview used by the canvas reader; `downloadUrl` stays the
  // full print-quality PDF, including its accessibility tags.
  const session = { title, url, downloadUrl, preview, opener, page: 0, fallback: false, zoom: 1, toc: [] };
  activePdf = session;
  pdfReaderTitle.textContent = title;
  updateReaderChrome();
  pdfReaderDownload.href = session.downloadUrl;
  pdfReaderDownload.setAttribute("download", "");
  pdfReaderStage.replaceChildren();
  pdfReaderTocList.replaceChildren();
  pdfReaderToc.hidden = true;
  pdfReaderTocToggle.setAttribute("aria-expanded", "false");
  pdfReaderTocToggle.hidden = true;
  showReaderToolsLoading();
  pdfReaderStatus.textContent = readerCopy("Loading PDF…", "Cargando PDF…");
  setPdfControls(null);
  pdfReaderPrevious.hidden = false;
  pdfReaderNext.hidden = false;
  pdfReader.showModal();
  session.watchdog = window.setTimeout(() => {
    if (activePdf === session && !session.page) showPdfFallback(session);
  }, 7000);

  try {
    const pdfjs = await (pdfjsPromise || import(new URL("build/pdf.min.mjs", pdfEngine)));
    if (activePdf !== session) return;
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("build/pdf.worker.min.mjs", pdfEngine).href;
    session.loadingTask = pdfjs.getDocument({
      url,
      standardFontDataUrl: new URL("web/standard_fonts/", pdfEngine).href,
      wasmUrl: new URL("web/wasm/", pdfEngine).href,
      iccUrl: new URL("web/iccs/", pdfEngine).href,
      isEvalSupported: false,
    });
    session.document = await session.loadingTask.promise;
    await buildToc(session);
    await showPdfPage(session, 1);
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
  if (!activePdf?.document || activePdf.fallback || !activePdf.page || activePdf.rendering) return;
  window.clearTimeout(readerResizeTimer);
  readerResizeTimer = window.setTimeout(() => showPdfPage(activePdf, activePdf.page), 150);
});
pdfReaderClose.addEventListener("click", () => pdfReader.close());
pdfReader.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    stepPdfPage(event.key === "ArrowLeft" ? -1 : 1);
  }
});
pdfReader.addEventListener("close", () => {
  const session = activePdf;
  activePdf = null;
  window.clearTimeout(session?.watchdog);
  try { session?.renderTask?.cancel(); } catch { /* already gone */ }
  try { session?.loadingTask?.destroy(); } catch { /* already gone */ }
  pdfReaderStage.replaceChildren();
  session?.opener.focus({ preventScroll: true });
});
