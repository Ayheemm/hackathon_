#!/usr/bin/env python3
"""
Ingest all PDFs from data/raw/pdfs/ into the FAISS index.
Usage: python ingest_local_pdfs.py
"""

import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from legal_rag.embeddings import OllamaEmbedder
from legal_rag.language import detect_language

sys.path.insert(0, str(ROOT))
from build_knowledge_base import (  # noqa: E402
    EMBED_DIM,
    FaissIndex,
    chunks_from_text,
    embed_and_index,
    extract_pdf_text,
    init_databases,
    is_done,
    mark_done,
)

PDF_FOLDER = ROOT / "data" / "raw" / "pdfs"


def main() -> None:
    print(f"\nScanning {PDF_FOLDER} for PDFs...\n")
    pdfs = list(PDF_FOLDER.glob("*.pdf"))
    if not pdfs:
        print("No PDFs found. Drop .pdf files into data/raw/pdfs/ and re-run.")
        return

    meta_db, log_db = init_databases()
    fi = FaissIndex(dim=EMBED_DIM)
    embedder = OllamaEmbedder(model_name="nomic-embed-text-v2-moe:latest")

    for pdf_path in pdfs:
        source_id = f"local_{pdf_path.stem}"
        if is_done(log_db, source_id):
            print(f"Skipping {pdf_path.name} (already indexed)")
            continue

        print(f"Processing: {pdf_path.name}")
        pdf_bytes = pdf_path.read_bytes()
        text = extract_pdf_text(pdf_bytes)

        if not text.strip():
            print("No text extracted. It may be scanned and require OCR.")
            continue

        lang = detect_language(text[:500])
        chunks, langs = chunks_from_text(text, lang)

        source = {
            "id": source_id,
            "name": pdf_path.stem.replace("_", " ").title(),
            "url": f"local://data/raw/pdfs/{pdf_path.name}",
            "tags": ["local", "pdf"],
        }

        added = embed_and_index(chunks, source, langs, embedder, fi, meta_db)
        mark_done(log_db, source_id, added)
        fi.save()
        print(f"Indexed {added} chunks from {pdf_path.name}")

    meta_db.commit()
    meta_db.close()
    log_db.close()
    print(f"\nDone. Total vectors in index: {fi.total}")


if __name__ == "__main__":
    main()
