import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from tqdm import tqdm

from .chunking import chunk_text
from .cleaning import read_jsonl
from .settings import DEFAULT_EMBEDDING_MODEL


@dataclass(frozen=True)
class IndexConfig:
    embedding_model_name: str = DEFAULT_EMBEDDING_MODEL
    chunk_size: int = 400
    chunk_overlap: int = 80
    chunk_min_chars: int = 80
    batch_size: int = 32


def _reset_metadata_db(db_path: Path) -> sqlite3.Connection:
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            chunk_id INTEGER PRIMARY KEY,
            article_id TEXT NOT NULL,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            lang TEXT NOT NULL,
            chunk_text TEXT NOT NULL
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_lang ON chunks(lang)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_chunks_url ON chunks(url)")
    return conn


def build_index(clean_jsonl: Path, faiss_index_path: Path, metadata_db: Path, config: IndexConfig) -> int:
    try:
        import faiss
        import numpy as np
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise ImportError(
            "Missing ML dependencies. Install requirements.txt before building the index."
        ) from exc

    rows: List[Dict[str, str]] = []
    texts: List[str] = []

    for doc in tqdm(read_jsonl(clean_jsonl), desc="Chunking clean documents"):
        chunks = chunk_text(
            doc.get("body_clean", ""),
            chunk_size=config.chunk_size,
            overlap=config.chunk_overlap,
            min_chars=config.chunk_min_chars,
        )

        for chunk in chunks:
            rows.append(
                {
                    "article_id": doc.get("id", ""),
                    "url": doc.get("url", ""),
                    "title": doc.get("title", "Untitled"),
                    "lang": doc.get("lang", "fr"),
                    "chunk_text": chunk,
                }
            )
            texts.append(chunk)

    if not texts:
        raise ValueError("No chunks generated. Verify scraping and cleaning outputs.")

    model = SentenceTransformer(config.embedding_model_name)
    embeddings = model.encode(
        texts,
        batch_size=config.batch_size,
        show_progress_bar=True,
        normalize_embeddings=True,
    )

    vectors = np.asarray(embeddings, dtype="float32")
    index = faiss.IndexFlatIP(vectors.shape[1])
    index.add(vectors)
    faiss.write_index(index, str(faiss_index_path))

    conn = _reset_metadata_db(metadata_db)
    with conn:
        conn.executemany(
            """
            INSERT INTO chunks (chunk_id, article_id, url, title, lang, chunk_text)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    chunk_id,
                    row["article_id"],
                    row["url"],
                    row["title"],
                    row["lang"],
                    row["chunk_text"],
                )
                for chunk_id, row in enumerate(rows)
            ],
        )

    conn.close()
    return len(rows)
