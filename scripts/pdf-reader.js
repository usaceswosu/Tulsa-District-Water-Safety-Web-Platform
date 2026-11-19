const pdfReader = document.querySelector("#pdf-reader");
const pdfReaderTitle = document.querySelector("#pdf-reader-title");
const pdfReaderClose = document.querySelector("#pdf-reader-close");
const pdfReaderDownload = document.querySelector("#pdf-reader-download");
const pdfReaderStage = document.querySelector("#pdf-reader-stage");
const pdfReaderStatus = document.querySelector("#pdf-reader-status");

let activePdf;

function readerCopy(english, spanish) {
  return document.documentElement.lang === "es" ? spanish : english;
}

function updateReaderChrome() {
  pdfReaderClose.textContent = readerCopy("Back to the library", "Volver a la biblioteca");
  pdfReaderDownload.textContent = readerCopy("Download PDF", "Descargar PDF");
  if (activePdf) {
    pdfReaderStatus.textContent = readerCopy(
      "Use your browser’s PDF controls to zoom or change pages.",
      "Usa los controles del PDF de tu navegador para ampliar o cambiar de página."
    );
  }
}

// The page language can change while the reader is open.
window.updatePdfReaderLanguage = updateReaderChrome;

function openPdfReader(url, title, opener) {
  activePdf = { url, title, opener };
  pdfReaderTitle.textContent = title;
  pdfReaderDownload.href = url;
  updateReaderChrome();
  const frame = document.createElement("iframe");
  frame.className = "pdf-reader-frame";
  frame.src = url;
  frame.title = `${title} PDF`;
  pdfReaderStage.replaceChildren(frame);
  pdfReader.showModal();
}

pdfReaderClose.addEventListener("click", () => pdfReader.close());
pdfReader.addEventListener("close", () => {
  const session = activePdf;
  activePdf = null;
  pdfReaderStage.replaceChildren();
  session?.opener?.focus({ preventScroll: true });
});
