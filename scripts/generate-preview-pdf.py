#!/usr/bin/env python3
"""Build a lightweight reader preview from a print-quality PDF.

Each page is rasterized, JPEG-compressed, and wrapped in a new PDF. The original
print file is never modified, so its 300 DPI artwork and accessibility tags stay
intact.

Requirements:
    python3 -m pip install pypdfium2 img2pdf pillow

Usage:
    python3 scripts/generate-preview-pdf.py INPUT.pdf OUTPUT.pdf [DPI] [QUALITY]
    python3 scripts/generate-preview-pdf.py "assets/pdfs/Foo.pdf" "assets/pdfs/web/Foo-web.pdf" 120 72

The site's current previews use 120 DPI and JPEG quality 72.
"""
from __future__ import annotations

import argparse
import io
from pathlib import Path

import img2pdf
import pypdfium2 as pdfium


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path, help="print-quality PDF")
    parser.add_argument("output", type=Path, help="reader preview PDF to write")
    parser.add_argument("--dpi", type=int, default=120, help="render resolution (default: 120)")
    parser.add_argument("--quality", type=int, default=72, help="JPEG quality 1-100 (default: 72)")
    args = parser.parse_args()

    if not args.source.is_file():
        parser.error(f"source PDF not found: {args.source}")
    if args.source.resolve() == args.output.resolve():
        parser.error("output must be a different file so the print PDF is never overwritten")
    if not 1 <= args.quality <= 100:
        parser.error("quality must be between 1 and 100")

    pdf = pdfium.PdfDocument(args.source)
    images: list[bytes] = []
    for page in pdf:
        bitmap = page.render(scale=args.dpi / 72)
        image = bitmap.to_pil().convert("RGB")
        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=args.quality, optimize=True, progressive=False)
        images.append(buffer.getvalue())

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(img2pdf.convert(images, dpi=args.dpi))
    print(
        f"{args.source.name}: {args.source.stat().st_size} -> {args.output.stat().st_size} bytes | "
        f"pages {len(pdf)} -> {len(pdfium.PdfDocument(args.output))}"
    )


if __name__ == "__main__":
    main()
