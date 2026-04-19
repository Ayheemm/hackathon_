"""
rag_engine.py
Loaded once at Flask startup. Call answer(query, history) from your routes.
Requires env var:  HF_TOKEN=your_huggingface_token
"""
import os
import re
import pickle
from pathlib import Path

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from huggingface_hub import InferenceClient
from langdetect import detect, LangDetectException

# ── Paths (relative to this file's location) ──────────────────────────────────
BASE       = Path(__file__).parent
INDEX_PATH = BASE / "data" / "legal_index.faiss"
META_PATH  = BASE / "data" / "legal_metadata.pkl"

# ── Model ─────────────────────────────────────────────────────────────────────
LLM_MODEL = "meta-llama/Llama-3.1-8B-Instruct"

# ── Load at import time (once) ────────────────────────────────────────────────
print("[MIZAN] Loading FAISS index and metadata...")
_index = faiss.read_index(str(INDEX_PATH))
with open(META_PATH, "rb") as _f:
    _meta = pickle.load(_f)
_chunks   = _meta["chunks"]
_embedder = SentenceTransformer(_meta["embed_model"])
_client   = InferenceClient(token=os.getenv("HF_TOKEN", ""))
print(f"[MIZAN] Ready — {_index.ntotal} vectors | {len(_chunks)} chunks")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _detect_lang(text: str) -> str:
    ar_ratio = len(re.findall(r"[\u0600-\u06FF]", text)) / max(len(text), 1)
    if ar_ratio > 0.20:
        return "ar"
    try:
        return detect(text)
    except LangDetectException:
        return "fr"


def retrieve(query: str, k: int = 6) -> list:
    """Return top-k most similar chunks for the query."""
    q_vec = _embedder.encode(
        [query],
        normalize_embeddings=True,
        convert_to_numpy=True,
    ).astype("float32")
    scores, indices = _index.search(q_vec, k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx != -1:
            chunk = _chunks[idx].copy()
            chunk["score"] = float(score)
            results.append(chunk)
    return results


def _build_messages(query: str, contexts: list, history: list) -> list:
    """Build OpenAI-style messages list for chat_completion."""
    lang = _detect_lang(query)

    if lang == "ar":
        system_content = (
            "أنت MIZAN، مساعد قانوني متخصص في القانون التونسي. "
            "أجب فقط بناءً على النصوص القانونية المقدمة أدناه. "
            "اذكر دائماً اسم النص القانوني والفصل. "
            "إذا لم تجد الإجابة في النصوص، قل ذلك صراحةً. "
            "لا تقدم استشارات قانونية شخصية."
        )
    else:
        system_content = (
            "Tu es MIZAN, un assistant juridique expert en droit tunisien. "
            "Réponds UNIQUEMENT en te basant sur les textes juridiques fournis ci-dessous. "
            "Cite toujours le nom exact du texte et l'article concerné. "
            "Si la réponse n'est pas dans les textes, indique-le clairement. "
            "Ne donne jamais de conseils juridiques personnels. "
            "Réponds dans la même langue que la question."
        )

    # Build context block
    ctx_lines = []
    for i, c in enumerate(contexts, 1):
        ctx_lines.append(
            f"[Texte {i}] Source: {c['source']} | Article: {c.get('article','N/A')}\n"
            f"{c['text']}\n"
        )
    context_block = "\n".join(ctx_lines)

    # Build messages
    messages = [{"role": "system", "content": system_content}]

    # Include last 3 turns of history
    for turn in (history or [])[-3:]:
        if turn.get("user"):
            messages.append({"role": "user", "content": turn["user"]})
        if turn.get("assistant"):
            messages.append({"role": "assistant", "content": turn["assistant"]})

    # Final user message with context
    user_content = (
        f"Textes juridiques pertinents:\n{context_block}\n\n"
        f"Question: {query}"
    )
    messages.append({"role": "user", "content": user_content})
    return messages


def answer(query: str, history: list = None, k: int = 6) -> dict:
    """
    Main entry point.
    Returns: {
        answer: str,
        sources: [{title, source, article, url, score}],
        language: str,
        error: str | None
    }
    """
    if not query.strip():
        return {"answer": "Veuillez poser une question.", "sources": [], "language": "fr"}

    contexts = retrieve(query, k=k)
    if not contexts:
        return {
            "answer": "Aucun texte juridique pertinent trouvé dans la base.",
            "sources": [],
            "language": _detect_lang(query),
        }

    messages = _build_messages(query, contexts, history or [])

    try:
        response = _client.chat_completion(
            model=LLM_MODEL,
            messages=messages,
            max_tokens=800,
            temperature=0.1,
            top_p=0.95,
        )
        answer_text = response.choices[0].message.content.strip()
    except Exception as e:
        # Graceful fallback: return the most relevant chunks directly
        fallback_parts = []
        for c in contexts[:3]:
            fallback_parts.append(
                f"**{c['source']}** — {c.get('article','')}\n{c['text'][:500]}"
            )
        answer_text = (
            "[Réponse hors-ligne — extraits directs]\n\n"
            + "\n\n---\n\n".join(fallback_parts)
        )
        return {
            "answer": answer_text,
            "sources": [
                {
                    "title":   c.get("title", c["source"]),
                    "source":  c["source"],
                    "article": c.get("article", ""),
                    "url":     c.get("url", ""),
                    "score":   round(c["score"], 4),
                }
                for c in contexts
            ],
            "language": _detect_lang(query),
            "error": str(e),
        }

    return {
        "answer": answer_text,
        "sources": [
            {
                "title":   c.get("title", c["source"]),
                "source":  c["source"],
                "article": c.get("article", ""),
                "url":     c.get("url", ""),
                "score":   round(c["score"], 4),
            }
            for c in contexts
        ],
        "language": _detect_lang(query),
        "error": None,
    }
