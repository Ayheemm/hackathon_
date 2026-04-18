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
    parser.add_argument("--model-path", default=None, help="Optional GGUF model path")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=7860, help="Port to bind")
    parser.add_argument("--k", type=int, default=5, help="Top-k chunks")
    parser.add_argument("--min-score", type=float, default=0.35, help="Minimum retrieval score")
    parser.add_argument("--share", action="store_true", help="Enable Gradio share link")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    import gradio as gr

    from legal_rag.rag import LegalRagEngine

    paths = ProjectPaths()
    model_path = Path(args.model_path) if args.model_path else None

    engine = LegalRagEngine(
        index_path=paths.faiss_index,
        metadata_db_path=paths.metadata_db,
        model_path=model_path,
    )

    def respond(message: str, history):
        result = engine.answer(query=message, k=args.k, min_score=args.min_score)
        text = result["answer"]
        if result["language"] == "ar":
            return f'<div dir="rtl" style="text-align: right">{text}</div>'
        return text

    demo = gr.ChatInterface(
        fn=respond,
        title="Tunisian Legal Assistant (Arabic + French)",
        description=(
            "Local bilingual legal chatbot with RAG over Tunisian legal texts. "
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
