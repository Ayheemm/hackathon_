import sqlite3
from pathlib import Path
from typing import Dict, List

from .settings import DEFAULT_EMBEDDING_MODEL


class FaissRetriever:
    def __init__(self, index_path: Path, metadata_db_path: Path, embedding_model_name: str = DEFAULT_EMBEDDING_MODEL):
        try:
            import faiss
            import numpy as np
            from sentence_transformers import SentenceTransformer
        except ImportError as exc:
            raise ImportError(
                "Missing retrieval dependencies. Install requirements.txt before querying the chatbot."
            ) from exc

        if not index_path.exists():
            raise FileNotFoundError(f"Missing FAISS index: {index_path}")
        if not metadata_db_path.exists():
            raise FileNotFoundError(f"Missing metadata DB: {metadata_db_path}")

        self._np = np
        self.index = faiss.read_index(str(index_path))
        self.conn = sqlite3.connect(metadata_db_path)
        self.embedding_model = SentenceTransformer(embedding_model_name)

    def _fetch_metadata(self, chunk_id: int) -> Dict[str, str]:
        row = self.conn.execute(
            "SELECT url, title, lang, chunk_text FROM chunks WHERE chunk_id = ?",
            (chunk_id,),
        ).fetchone()
        if row is None:
            return {}
        return {
            "url": row[0],
            "title": row[1],
            "lang": row[2],
            "text": row[3],
        }

    def retrieve(self, query: str, k: int = 5, min_score: float = 0.35) -> List[Dict[str, str]]:
        query_vector = self.embedding_model.encode([query], normalize_embeddings=True)
        query_vector = self._np.asarray(query_vector, dtype="float32")

        scores, ids = self.index.search(query_vector, k)

        matches: List[Dict[str, str]] = []
        for score, chunk_id in zip(scores[0], ids[0]):
            if chunk_id < 0:
                continue
            if float(score) < min_score:
                continue

            metadata = self._fetch_metadata(int(chunk_id))
            if not metadata:
                continue

            metadata["score"] = float(score)
            metadata["chunk_id"] = int(chunk_id)
            matches.append(metadata)

        return matches

    def close(self) -> None:
        self.conn.close()
