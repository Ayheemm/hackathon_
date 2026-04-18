"""
MIZAN Legal RAG — Query Engine
Drop this file at:  src/legal_rag/rag.py

Dependencies already in requirements.txt:
    faiss-cpu, numpy, requests
Optional (install separately):
    sentence-transformers  (for offline HuggingFace embedder fallback)
"""
from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any

import faiss
import numpy as np

logger = logging.getLogger(__name__)


# ─── Lazy imports so the engine starts even if Ollama is down ────────────────

def _get_embedder(model_name: str = "nomic-embed-text-v2-moe:latest"):
    """Return the OllamaEmbedder, or a SentenceTransformer fallback."""
    try:
        from legal_rag.embeddings import OllamaEmbedder  # type: ignore
        emb = OllamaEmbedder(model_name=model_name)
        # Quick health-check
        emb.encode(["test"], normalize_embeddings=True)
        return emb
    except Exception as e:
        logger.warning(f"OllamaEmbedder unavailable ({e}). Trying SentenceTransformer fallback…")
        from sentence_transformers import SentenceTransformer  # type: ignore
        return SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")


# ─── Engine ──────────────────────────────────────────────────────────────────

class LegalRagEngine:
    """
    Minimal RAG engine that wraps a FAISS index + SQLite metadata store.

    Usage (from NOTEBOOK_INTEGRATION.md):
        engine = LegalRagEngine(
            index_path=paths.faiss_index,
            metadata_db_path=paths.metadata_db,
            model_path=None,          # set path to .gguf for local LLM
        )
        result = engine.answer("Quelle est la procédure d'appel en matière civile ?")
        print(result["answer"])
    """

    def __init__(
        self,
        index_path: str | Path,
        metadata_db_path: str | Path,
        model_path: str | Path | None = None,
        embed_model: str = "nomic-embed-text-v2-moe:latest",
        top_k: int = 5,
        hf_api_token: str | None = None,
        hf_model_id: str = "mistralai/Mistral-7B-Instruct-v0.3",
        ollama_chat_model: str = "qwen3.5:4b",
    ):
        self.index_path = Path(index_path)
        self.metadata_db_path = Path(metadata_db_path)
        self.model_path = Path(model_path) if model_path else None
        self.top_k = top_k
        self.hf_api_token = hf_api_token or _try_env_token()
        self.hf_model_id = hf_model_id
        self.ollama_chat_model = ollama_chat_model

        # Load FAISS index
        if not self.index_path.exists():
            raise FileNotFoundError(
                f"FAISS index not found: {self.index_path}\n"
                "Run build_knowledge_base.py first to create the index."
            )
        self.index: faiss.Index = faiss.read_index(str(self.index_path))
        logger.info(f"Loaded FAISS index: {self.index.ntotal} vectors")

        # Metadata DB
        self._db = sqlite3.connect(str(self.metadata_db_path), check_same_thread=False)
        self._db.row_factory = sqlite3.Row

        # Embedder (lazy)
        self._embedder = None
        self._embed_model_name = embed_model

    # ── Public API ────────────────────────────────────────────────────────────

    def retrieve(self, query: str, top_k: int | None = None) -> list[dict]:
        """Retrieve the top-k most relevant chunks for *query*."""
        k = top_k or self.top_k
        emb = self._embed([query])           # (1, D)
        D, I = self.index.search(emb, k)     # (1, k)

        results = []
        for rank, (dist, idx) in enumerate(zip(D[0], I[0])):
            if idx == -1:
                continue
            meta = self._get_metadata(int(idx))
            if meta:
                results.append({
                    "rank": rank + 1,
                    "score": float(dist),
                    "text": meta["chunk_text"],
                    "source": meta["source_name"],
                    "url": meta["source_url"],
                    "language": meta["language"],
                    "chunk_id": int(idx),
                })
        return results

    def answer(self, query: str, top_k: int | None = None) -> dict[str, Any]:
        """Full RAG pipeline: retrieve → build prompt → generate answer."""
        chunks = self.retrieve(query, top_k)
        if not chunks:
            return {
                "answer": "Je n'ai pas trouvé d'informations pertinentes dans la base de connaissances.",
                "sources": [],
                "chunks_used": 0,
            }

        context = self._build_context(chunks)
        prompt = self._build_prompt(query, context)

        answer_text = self._generate(prompt)

        return {
            "answer": answer_text,
            "sources": [{"name": c["source"], "url": c["url"]} for c in chunks],
            "chunks_used": len(chunks),
            "retrieved_chunks": chunks,
        }

    # ── Internal ─────────────────────────────────────────────────────────────

    def _embed(self, texts: list[str]) -> np.ndarray:
        if self._embedder is None:
            self._embedder = _get_embedder(self._embed_model_name)
        arr = self._embedder.encode(texts, normalize_embeddings=True)
        return arr.astype("float32")

    def _get_metadata(self, faiss_id: int) -> dict | None:
        row = self._db.execute(
            "SELECT * FROM chunks WHERE faiss_id = ?", (faiss_id,)
        ).fetchone()
        return dict(row) if row else None

    @staticmethod
    def _build_context(chunks: list[dict]) -> str:
        parts = []
        for c in chunks:
            snippet = c["text"][:1200]
            parts.append(
                f"[Source: {c['source']} - {c['url']}]\n{snippet}"
            )
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _build_prompt(query: str, context: str) -> str:
        return (
            "Tu es MIZAN, un assistant juridique spécialisé en droit tunisien. "
            "Réponds en te basant UNIQUEMENT sur les extraits fournis. "
            "Si l'information n'est pas dans les extraits, dis-le clairement. "
            "Cite les sources que tu utilises.\n\n"
            f"EXTRAITS JURIDIQUES :\n{context}\n\n"
            f"QUESTION : {query}\n\n"
            "RÉPONSE :"
        )

    def _generate(self, prompt: str) -> str:
        """Try Ollama → HuggingFace API → fallback message."""
        # 1. Ollama (local, preferred)
        try:
            return _ollama_generate(prompt, self.ollama_chat_model)
        except Exception as e:
            logger.warning(f"Ollama generation failed ({e}). Trying HuggingFace API…")

        # 2. HuggingFace Inference API (free tier)
        if self.hf_api_token:
            try:
                return _hf_generate(prompt, self.hf_model_id, self.hf_api_token)
            except Exception as e:
                logger.warning(f"HuggingFace API failed ({e}).")

        # 3. Graceful degradation — return retrieved context summary
        return (
            "[LLM non disponible — réponse basée sur les extraits récupérés]\n"
            + prompt.split("RÉPONSE :")[0].split("EXTRAITS JURIDIQUES :")[-1][:500]
        )

    def close(self):
        self._db.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()


# ─── LLM helpers ─────────────────────────────────────────────────────────────

def _ollama_generate(prompt: str, model: str, timeout: int = 120) -> str:
    import requests
    resp = requests.post(
        "http://localhost:11434/api/generate",
        json={"model": model, "prompt": prompt, "stream": False, "think": False,
              "options": {"temperature": 0.1, "num_predict": 128, "hidethinking": True}},
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    text = (data.get("response") or data.get("thinking") or "").strip()
    if not text:
        raise RuntimeError(f"Ollama returned empty output. Raw payload: {data}")
    return text


def _hf_generate(prompt: str, model_id: str, token: str, timeout: int = 60) -> str:
    import requests
    resp = requests.post(
        f"https://api-inference.huggingface.co/models/{model_id}",
        headers={"Authorization": f"Bearer {token}"},
        json={"inputs": prompt, "parameters": {"max_new_tokens": 512, "temperature": 0.1}},
        timeout=timeout,
    )
    resp.raise_for_status()
    data = resp.json()
    if isinstance(data, list) and data:
        text = data[0].get("generated_text", "")
        # Strip the prompt echo if present
        if text.startswith(prompt):
            text = text[len(prompt):]
        return text.strip()
    return str(data)


def _try_env_token() -> str | None:
    import os
    return os.environ.get("HF_API_KEY") or os.environ.get("HUGGINGFACE_TOKEN")
