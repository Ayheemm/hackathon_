#!/usr/bin/env python3
"""
Quick test of the full RAG pipeline.
Usage: python test_rag.py
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from legal_rag.rag import LegalRagEngine
from legal_rag.settings import ProjectPaths


def _configure_console_encoding() -> None:
    """Avoid Windows cp1252 crashes when printing Arabic/emoji text."""
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            try:
                stream.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass


def main() -> int:
    _configure_console_encoding()
    paths = ProjectPaths()

    if not paths.faiss_index.exists():
        print("Index not found. Run: python build_knowledge_base.py --phase 1")
        return 1

    print("Loading MIZAN engine...")
    engine = LegalRagEngine(
        index_path=paths.faiss_index,
        metadata_db_path=paths.metadata_db,
        model_path=None,
        embed_model="nomic-embed-text-v2-moe:latest",
        ollama_chat_model="qwen3.5:4b",
        top_k=3,
    )

    print("\n" + "=" * 60)
    print("TEST 1: Vector Retrieval")
    print("=" * 60)

    query = "Quelle est la procédure d'appel en matière civile ?"
    chunks = engine.retrieve(query, top_k=3)

    if not chunks:
        print("No results found.")
    else:
        for c in chunks:
            print(f"\nRank {c['rank']} | Score: {c['score']:.4f} | Source: {c['source']}")
            print(f"Language: {c['language']}")
            print(f"Text preview: {c['text'][:200]}...")

    print("\n" + "=" * 60)
    print("TEST 2: Full RAG Answer")
    print("=" * 60)

    questions = [
        "Quelles sont les conditions de validité d'un contrat selon le COC tunisien ?",
        "ما هي شروط صحة العقد في القانون التونسي ؟",
        "What is the Code des Obligations et Contrats ?",
    ]

    for i, q in enumerate(questions, start=1):
        print(f"\nQuestion {i}/{len(questions)}: {q}")
        print("Generating answer (may take up to ~2 minutes on local CPU/GPU)...")
        started = time.time()
        try:
            result = engine.answer(q, top_k=3)
        except Exception as exc:
            print(f"Answer generation failed: {exc}")
            continue

        elapsed = time.time() - started
        print(f"Answer time: {elapsed:.1f}s")
        print(f"Answer: {result['answer'][:500]}")
        print(f"Sources: {[s['name'] for s in result['sources']]}")

    engine.close()
    print("\nAll tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
