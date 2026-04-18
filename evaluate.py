#!/usr/bin/env python3
"""
Evaluates retrieval quality on a set of known questions.
Usage: python evaluate.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from legal_rag.rag import LegalRagEngine
from legal_rag.settings import ProjectPaths


def main() -> int:
    paths = ProjectPaths()
    engine = LegalRagEngine(
        index_path=paths.faiss_index,
        metadata_db_path=paths.metadata_db,
        ollama_chat_model="qwen3.5:4b",
        embed_model="nomic-embed-text-v2-moe:latest",
        top_k=5,
    )

    test_questions = [
        {
            "q": "Qu'est-ce que le Code des Obligations et Contrats ?",
            "expected_source": "Code des Obligations et Contrats",
        },
        {
            "q": "Quelles sont les dispositions de la Constitution tunisienne 2022 ?",
            "expected_source": "Constitution",
        },
        {
            "q": "ما هو قانون الشركات التجارية ؟",
            "expected_source": "Sociétés",
        },
    ]

    print("\n" + "=" * 70)
    print("MIZAN EVALUATION")
    print("=" * 70)

    hits = 0
    for i, test in enumerate(test_questions, start=1):
        print(f"\nQ{i}: {test['q']}")
        chunks = engine.retrieve(test["q"], top_k=3)
        if chunks:
            top_source = chunks[0]["source"]
            score = chunks[0]["score"]
            match = test["expected_source"].lower() in top_source.lower()
            status = "HIT" if match else "MISS"
            if match:
                hits += 1
            print(f"  {status} | Score: {score:.4f} | Top source: {top_source}")
        else:
            print("  NO RESULTS")

    print(f"\n{'=' * 70}")
    print(f"RETRIEVAL ACCURACY: {hits}/{len(test_questions)} = {100 * hits / len(test_questions):.0f}%")
    print(f"Index size: {engine.index.ntotal} vectors")
    print("=" * 70)

    engine.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
