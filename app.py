"""
app.py  —  MIZAN Flask Backend
Run:  python app.py
      (HF_TOKEN must be set as environment variable)

Windows PowerShell:
    $env:HF_TOKEN="hf_your_token_here"; python app.py

Linux/Mac:
    HF_TOKEN=hf_your_token_here python app.py
"""
import os
import logging
from flask import Flask, request, jsonify, Response
from flask_cors import CORS

# rag_engine loads the FAISS index at import time (heavy, done once)
from rag_engine import answer as rag_answer, retrieve, _detect_lang

# ── App setup ──────────────────────────────────────────────────────────────────
app = Flask(__name__)

# Allow all origins during development.
# In production, replace "*" with your frontend URL.
CORS(app, resources={r"/*": {"origins": "*"}})

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("mizan")


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    """Quick liveness check — your frontend can poll this on startup."""
    return jsonify({"status": "ok", "model": "MIZAN RAG v2"})


@app.route("/chat", methods=["POST"])
def chat():
    """
    Main chat endpoint.

    Request body (JSON):
        {
            "message":  "string — the user's question",
            "history":  [                      // optional
                {"user": "...", "assistant": "..."},
                ...
            ]
        }

    Response (JSON):
        {
            "answer":   "string",
            "sources":  [
                {"title": "...", "source": "...", "article": "...",
                 "url": "...", "score": 0.87}
            ],
            "language": "fr" | "ar",
            "error":    null | "string"
        }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON body"}), 400

    query   = data.get("message", "").strip()
    history = data.get("history", [])

    if not query:
        return jsonify({"error": "message field is required"}), 400

    log.info(f"Query: {query[:80]}")
    result = rag_answer(query, history=history)
    log.info(f"Answer: {result['answer'][:80]}")

    return jsonify(result)


@app.route("/retrieve", methods=["POST"])
def retrieve_only():
    """
    Returns raw chunks without calling the LLM.
    Useful for the frontend to show 'related articles' sidebar.

    Request: {"message": "...", "k": 5}
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Invalid JSON"}), 400

    query = data.get("message", "").strip()
    k     = min(int(data.get("k", 5)), 10)

    if not query:
        return jsonify({"error": "message required"}), 400

    chunks = retrieve(query, k=k)
    return jsonify({
        "results": [
            {
                "title":   c.get("title", c["source"]),
                "source":  c["source"],
                "article": c.get("article", ""),
                "url":     c.get("url", ""),
                "excerpt": c["text"][:300],
                "score":   round(c["score"], 4),
            }
            for c in chunks
        ],
        "language": _detect_lang(query),
    })


@app.route("/detect-language", methods=["POST"])
def detect_language():
    """
    Detects whether a query is French or Arabic.
    Used by the frontend to switch input direction automatically.

    Request: {"text": "..."}
    """
    data  = request.get_json(silent=True) or {}
    text  = data.get("text", "")
    lang  = _detect_lang(text) if text else "fr"
    return jsonify({"language": lang, "rtl": lang == "ar"})


# ── Error handlers ─────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Route not found"}), 404


@app.errorhandler(500)
def server_error(e):
    log.error(f"Internal error: {e}")
    return jsonify({"error": "Internal server error"}), 500


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    token = os.getenv("HF_TOKEN", "")
    if not token:
        print("=" * 60)
        print("  WARNING: HF_TOKEN is not set!")
        print("  Set it before running:")
        print("  Windows: $env:HF_TOKEN='hf_...' ; python app.py")
        print("  Linux:   HF_TOKEN=hf_... python app.py")
        print("=" * 60)

    port = int(os.getenv("PORT", 5000))
    print(f"\n  MIZAN backend running at http://localhost:{port}")
    print(f"  Health check: http://localhost:{port}/health\n")
    app.run(debug=False, host="0.0.0.0", port=port)
