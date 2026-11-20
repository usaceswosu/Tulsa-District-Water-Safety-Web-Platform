const pdfReader = document.querySelector("#pdf-reader");
const pdfReaderTitle = document.querySelector("#pdf-reader-title");
const pdfReaderClose = document.querySelector("#pdf-reader-close");
const pdfReaderDownload = document.querySelector("#pdf-reader-download");
const pdfReaderStage = document.querySelector("#pdf-reader-stage");
const pdfReaderStatus = document.querySelector("#pdf-reader-status");
const pdfReaderPrevious = document.querySelector("#pdf-reader-prev");
const pdfReaderNext = document.querySelector("#pdf-reader-next");

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

// If the scripted reader cannot start, fall back to the browser's own PDF viewer.
function showPdfFallback(session) {
  if (!session || activePdf !== session) return;
  window.clearTimeout(session.watchdog);
  session.fallback = true;
  try { session.loadingTask?.destroy(); } catch { /* already gone */ }
  setPdfControls(null);
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
  pdfReaderStatus.textContent = readerCopy("Loading page…", "Cargando página…");
  try {
    const page = await session.document.getPage(pageNumber);
    if (activePdf !== session) return;
    const natural = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: Math.min(4, 1800 / Math.max(natural.width, natural.height)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.setProperty("--page-ratio", viewport.width / viewport.height);
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
    pdfReaderStatus.textContent = label;
  } catch {
    if (activePdf === session) showPdfFallback(session);
  } finally {
    session.renderTask = null;
    session.rendering = false;
    if (activePdf === session && session.page) setPdfControls(session.document, session.page);
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
  pdfReaderPrevious.textContent = readerCopy("Previous page", "Página anterior");
  pdfReaderNext.textContent = readerCopy("Next page", "Página siguiente");
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

async function openPdfReader(url, title, opener, downloadUrl = url, preview = false) {
  // `url` is the fast preview used by the canvas reader; `downloadUrl` stays the
  // full print-quality PDF, including its accessibility tags.
  const session = { title, url, downloadUrl, preview, opener, page: 0, fallback: false };
  activePdf = session;
  pdfReaderTitle.textContent = title;
  updateReaderChrome();
  pdfReaderDownload.href = session.downloadUrl;
  pdfReaderDownload.setAttribute("download", "");
  pdfReaderStage.replaceChildren();
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
