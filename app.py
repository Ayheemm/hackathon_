import argparse
import base64
import mimetypes
import sys
from pathlib import Path
from typing import Optional

import requests

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from legal_rag.settings import ProjectPaths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run MIZAN legal chatbot demo")
    parser.add_argument(
        "--model-path",
        default="qwen3.5:4b",
        help="GGUF model path or Ollama chat model reference",
    )
    parser.add_argument("--vision-model", default="medgemma:4b", help="Ollama model for image analysis")
    parser.add_argument("--embed-model", default="nomic-embed-text-v2-moe:latest", help="Embedding model name")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=7860, help="Port to bind")
    parser.add_argument("--k", type=int, default=5, help="Top-k chunks")
    parser.add_argument("--share", action="store_true", help="Enable Gradio share link")
    return parser.parse_args()


def _ollama_generate(
    model: str,
    prompt: str,
    images: Optional[list[str]] = None,
    max_tokens: int = 192,
    temperature: float = 0.1,
) -> str:
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
            "hidethinking": True,
        },
    }
    if images:
        payload["images"] = images

    response = requests.post("http://localhost:11434/api/generate", json=payload, timeout=180)
    response.raise_for_status()
    data = response.json()
    text = (data.get("response") or data.get("thinking") or "").strip()
    if not text:
        raise RuntimeError(f"Ollama returned empty output. Raw payload: {data}")
    return text


def _extract_pdf_text(pdf_path: Path, max_pages: int = 20) -> str:
    try:
        import pdfplumber
    except ImportError:
        return ""

    pages_text: list[str] = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page in pdf.pages[:max_pages]:
            text = page.extract_text() or ""
            if text.strip():
                pages_text.append(text)
    return "\n\n".join(pages_text)


def _resolve_file_path(item: object) -> Path:
    if isinstance(item, dict):
        return Path(item["path"])
    if isinstance(item, tuple):
        return Path(item[0])
    return Path(str(item))


def main() -> None:
    args = parse_args()

    import gradio as gr

    from legal_rag.rag import LegalRagEngine

    paths = ProjectPaths()
    paths.ensure_all()

    model_arg = Path(args.model_path)
    llm_path = model_arg if model_arg.exists() else None
    chat_model = args.model_path if llm_path is None else "qwen3.5:4b"

    try:
        engine = LegalRagEngine(
            index_path=paths.faiss_index,
            metadata_db_path=paths.metadata_db,
            model_path=llm_path,
            embed_model=args.embed_model,
            top_k=args.k,
            ollama_chat_model=chat_model,
        )
    except Exception as exc:
        raise SystemExit(f"Failed to initialize the legal chatbot engine: {exc}") from exc

    def respond(message: dict, history):
        del history
        try:
            text_query = (message.get("text") or "").strip()
            files = message.get("files") or []

            image_payloads: list[str] = []
            pdf_text_blocks: list[str] = []
            unsupported: list[str] = []

            for item in files:
                fpath = _resolve_file_path(item)
                mime, _ = mimetypes.guess_type(str(fpath))
                ext = fpath.suffix.lower()

                if mime and mime.startswith("image/"):
                    with open(fpath, "rb") as image_file:
                        image_payloads.append(base64.b64encode(image_file.read()).decode("utf-8"))
                    continue

                if ext == ".pdf":
                    extracted = _extract_pdf_text(fpath)
                    if extracted.strip():
                        pdf_text_blocks.append(f"[PDF: {fpath.name}]\n{extracted[:15000]}")
                    else:
                        pdf_text_blocks.append(
                            f"[PDF: {fpath.name}]\nNo text could be extracted. "
                            "If this PDF is scanned, run ocr_pdf.py first."
                        )
                    continue

                unsupported.append(fpath.name)

            if unsupported:
                return (
                    "Unsupported upload type: "
                    + ", ".join(unsupported)
                    + ". Supported: images and PDF files."
                )

            if image_payloads:
                prompt = text_query or "Analyse cette image juridique et résume les points importants."
                return _ollama_generate(args.vision_model, prompt, images=image_payloads, max_tokens=700)

            if pdf_text_blocks:
                question = text_query or "Résume ce document juridique tunisien."
                prompt = (
                    "Tu es MIZAN, assistant juridique tunisien. "
                    "Réponds en te basant uniquement sur le contenu PDF fourni.\n\n"
                    f"Question: {question}\n\n"
                    f"Contenu PDF:\n{'\n\n---\n\n'.join(pdf_text_blocks)}\n\n"
                    "Réponse:"
                )
                return _ollama_generate(chat_model, prompt, max_tokens=800)

            if not text_query:
                return "Posez une question juridique ou ajoutez une image/PDF."

            result = engine.answer(query=text_query, top_k=args.k)
            answer = result.get("answer", "")
            sources = result.get("sources", [])

            if sources and "Sources:" not in answer:
                seen: set[tuple[str, str]] = set()
                lines: list[str] = []
                for source in sources:
                    name = str(source.get("name", "Source"))
                    url = str(source.get("url", ""))
                    key = (name, url)
                    if key in seen:
                        continue
                    seen.add(key)
                    lines.append(f"- {name} ({url})")
                if lines:
                    answer += "\n\nSources:\n" + "\n".join(lines)

            return answer
        except Exception as exc:
            import traceback

            traceback.print_exc()
            return f"An internal error occurred: {exc}"

    demo = gr.ChatInterface(
        fn=respond,
        multimodal=True,
        title="MIZAN Tunisian Legal Assistant",
        description=(
            "RAG over Tunisian legal sources using qwen3.5:4b and "
            "nomic-embed-text-v2-moe:latest. Upload images for medgemma:4b analysis "
            "or upload PDFs for quick document Q&A."
        ),
        examples=[
            "ما هي إجراءات الطعن في حكم مدني؟",
            "Quelle est la procédure d'appel en matière civile ?",
            "Quelles sont les conditions de validité d'un contrat ?",
        ],
    )

    demo.launch(server_name=args.host, server_port=args.port, share=args.share)
    engine.close()


if __name__ == "__main__":
    main()
