#!/usr/bin/env python3
"""
OCR a scanned PDF using medgemma:4b via Ollama.
Usage: python ocr_pdf.py path/to/scanned.pdf
"""

import base64
import sys
from pathlib import Path

import requests

try:
    import fitz  # pip install pymupdf
except ImportError:
    print("Install PyMuPDF: pip install pymupdf")
    raise SystemExit(1)


def ocr_page(image_bytes: bytes) -> str:
    img_b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "model": "medgemma:4b",
        "prompt": (
            "This is a page from a Tunisian legal document. "
            "Extract all visible text exactly as it appears, preserving structure. "
            "Output only extracted text."
        ),
        "images": [img_b64],
        "stream": False,
        "options": {"temperature": 0.0, "hidethinking": True},
    }
    response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=180)
    response.raise_for_status()
    data = response.json()
    return (data.get("response") or data.get("thinking") or "").strip()


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python ocr_pdf.py path/to/file.pdf")
        return 1

    pdf_path = Path(sys.argv[1])
    out_path = pdf_path.with_suffix(".txt")

    if not pdf_path.exists():
        print(f"File not found: {pdf_path}")
        return 1

    doc = fitz.open(str(pdf_path))
    print(f"Processing {len(doc)} pages with medgemma:4b...")

    all_text: list[str] = []
    for i, page in enumerate(doc):
        print(f"  Page {i + 1}/{len(doc)}...", end="\r")
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        text = ocr_page(img_bytes)
        all_text.append(f"--- Page {i + 1} ---\n{text}")

    full_text = "\n\n".join(all_text)
    out_path.write_text(full_text, encoding="utf-8")
    print(f"\nOCR complete -> {out_path}")
    print(f"{len(full_text)} characters extracted")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
