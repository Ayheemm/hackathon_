import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from legal_rag.settings import ProjectPaths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run bilingual legal chatbot demo")
    parser.add_argument("--model-path", default="qwen3.5:4b", help="Optional GGUF model path or Ollama model reference")
    parser.add_argument("--vision-model", default="medgemma:4b", help="Ollama model reference for images")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=7860, help="Port to bind")
    parser.add_argument("--k", type=int, default=5, help="Top-k chunks")
    parser.add_argument("--min-score", type=float, default=0.35, help="Minimum retrieval score")
    parser.add_argument("--share", action="store_true", help="Enable Gradio share link")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    import gradio as gr
    import base64

    from legal_rag.rag import LegalRagEngine

    paths = ProjectPaths()
    model_ref = args.model_path

    try:
        engine = LegalRagEngine(
            index_path=paths.faiss_index,
            metadata_db_path=paths.metadata_db,
            model_ref=model_ref,
        )
    except Exception as exc:
        raise SystemExit(f"Failed to initialize the legal chatbot engine: {exc}") from exc

    def respond(message: dict, history):
        try:
            text_query = message.get("text", "")
            files = message.get("files", [])
            images = []
            unsupported_files = []
            for f in files:
                # Gradio may return tuples or dicts or strings for files in Multimodal
                f_path = f["path"] if isinstance(f, dict) else (f[0] if isinstance(f, tuple) else str(f))
                mimetype, _ = __import__("mimetypes").guess_type(f_path)
                if mimetype and mimetype.startswith("image/"):
                    with open(f_path, "rb") as image_file:
                        encoded = base64.b64encode(image_file.read()).decode("utf-8")
                        images.append(encoded)
                else:
                    unsupported_files.append(Path(f_path).name)

            if unsupported_files:
                unsupported_list = ", ".join(unsupported_files)
                return (
                    f"Unsupported upload type: {unsupported_list}. "
                    "Only image files are supported for vision analysis right now."
                )

            # Route to vision model if images are present
            if images and hasattr(engine.generator, 'model_ref'):
                original_ref = engine.generator.model_ref
                engine.generator.model_ref = args.vision_model
            else:
                original_ref = None

            result = engine.answer(query=text_query, k=args.k, min_score=args.min_score, images=images)
            
            # Restore original model
            if original_ref:
                engine.generator.model_ref = original_ref

            text = result["answer"]
            if result.get("error"):
                text += f"\n\n[ERROR] {result['error']}"
        except Exception as exc:
            import traceback

            traceback.print_exc()
            error_text = str(exc)
            if error_text:
                return f"An internal error occurred: {error_text}"
            return "An internal error occurred while handling your request. Check the server terminal for details."

        if result["language"] == "ar":
            return f'<div dir="rtl" style="text-align: right">{text}</div>'
        return text

    demo = gr.ChatInterface(
        fn=respond,
        multimodal=True,
        title="Tunisian Legal Assistant (Arabic + French + Vision)",
        description=(
            "Local bilingual legal chatbot with RAG over Tunisian legal texts. "
            "You can now upload images for vision analysis using medgemma:4b. "
            "Responses include source citations."
        ),
        examples=[
            "ما هي إجراءات الطعن في حكم مدني؟",
            "Quelle est la procedure pour faire appel d'un jugement civil ?",
            "Quels sont les delais de pourvoi en cassation ?",
        ],
    )

    demo.launch(server_name=args.host, server_port=args.port, share=args.share)
    engine.close()


if __name__ == "__main__":
    main()
