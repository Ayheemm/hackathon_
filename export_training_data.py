#!/usr/bin/env python3
"""
Exports the scraped legal chunks as a fine-tuning dataset.
Usage: python export_training_data.py
"""

import json
import random
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
META_DB = ROOT / "index" / "metadata.db"
OUTPUT = ROOT / "data" / "finetune_dataset.jsonl"


def main() -> int:
    OUTPUT.parent.mkdir(exist_ok=True)
    if not META_DB.exists():
        print("Metadata DB not found. Run build_knowledge_base.py first.")
        return 1

    conn = sqlite3.connect(str(META_DB))
    rows = conn.execute(
        "SELECT chunk_text, source_name, language FROM chunks ORDER BY RANDOM() LIMIT 5000"
    ).fetchall()
    conn.close()

    print(f"Loaded {len(rows)} chunks from metadata DB")

    instructions_fr = [
        "Résume ce texte juridique en 2-3 phrases simples.",
        "Quelles sont les obligations mentionnées dans ce texte ?",
        "Quels droits ce texte accorde-t-il aux citoyens ?",
        "Explique ce texte juridique à quelqu'un qui ne connaît pas le droit.",
        "Quelles sanctions sont prévues dans ce texte ?",
        "À quel code ou loi appartient ce texte ?",
    ]

    instructions_ar = [
        "لخّص هذا النص القانوني في 2-3 جمل بسيطة.",
        "ما هي الالتزامات المذكورة في هذا النص ؟",
        "ما هي الحقوق التي يمنحها هذا النص للمواطنين ؟",
        "اشرح هذا النص لشخص لا يعرف القانون.",
    ]

    records = []
    for chunk_text, source_name, language in rows:
        if len(chunk_text.strip()) < 100:
            continue

        instructions = instructions_ar if language == "ar" else instructions_fr
        instruction = random.choice(instructions)
        records.append(
            {
                "instruction": instruction,
                "input": chunk_text[:800],
                "output": f"[Source: {source_name}]\n{chunk_text[:300]}...",
                "source": source_name,
                "language": language,
            }
        )

    with open(OUTPUT, "w", encoding="utf-8") as file:
        for record in records:
            file.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(f"Wrote {len(records)} training examples -> {OUTPUT}")
    if records:
        print("Preview:")
        print(json.dumps(records[0], ensure_ascii=False, indent=2)[:500])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
