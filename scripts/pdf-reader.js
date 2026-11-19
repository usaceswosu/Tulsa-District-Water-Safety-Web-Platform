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

function readerCopy(english, spanish) {
  return document.documentElement.lang === "es" ? spanish : english;
}

function setPdfControls(documentProxy, page) {
  pdfReaderPrevious.setAttribute("aria-disabled", String(!documentProxy || page <= 1));
  pdfReaderNext.setAttribute("aria-disabled", String(!documentProxy || page >= documentProxy.numPages));
}

function showPdfError() {
  pdfReaderStage.replaceChildren();
  pdfReaderStatus.textContent = readerCopy(
    "Couldn't display this PDF. You can still download it.",
    "No se pudo mostrar este PDF. Puedes descargarlo."
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
    pdfReaderStage.replaceChildren(canvas);
    pdfReaderStatus.textContent = label;
  } catch {
    if (activePdf === session) showPdfError();
  } finally {
    session.renderTask = null;
    session.rendering = false;
    if (activePdf === session && session.page) setPdfControls(session.document, session.page);
  }
}

async function openPdfReader(url, title, opener) {
  const session = { title, opener, page: 0 };
  activePdf = session;
  pdfReaderTitle.textContent = title;
  pdfReaderClose.textContent = readerCopy("Back to the library", "Volver a la biblioteca");
  pdfReaderDownload.textContent = readerCopy("Download PDF", "Descargar PDF");
  pdfReaderDownload.href = url;
  pdfReaderPrevious.textContent = readerCopy("Previous page", "Página anterior");
  pdfReaderNext.textContent = readerCopy("Next page", "Página siguiente");
  pdfReaderStage.replaceChildren();
  pdfReaderStatus.textContent = readerCopy("Loading PDF…", "Cargando PDF…");
  setPdfControls(null);
  pdfReader.showModal();

  try {
    const pdfjs = await import(new URL("build/pdf.mjs", pdfEngine));
    if (activePdf !== session) return;
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("build/pdf.worker.mjs", pdfEngine).href;
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
    if (activePdf === session) showPdfError();
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
  session?.renderTask?.cancel();
  session?.loadingTask?.destroy().catch(() => {});
  pdfReaderStage.replaceChildren();
  session?.opener.focus({ preventScroll: true });
});
