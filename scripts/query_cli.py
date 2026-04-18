import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from legal_rag.settings import ProjectPaths


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ask one legal question from terminal")
    parser.add_argument("query", help="Arabic or French legal question")
    parser.add_argument("--model-path", default="qwen3.5:4b", help="GGUF model path or Ollama chat model reference")
    parser.add_argument("--embed-model", default="nomic-embed-text-v2-moe:latest", help="Embedding model name")
    parser.add_argument("--k", type=int, default=5, help="Top-k retrieval")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

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
        print(f"Initialization error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        result = engine.answer(query=args.query, top_k=args.k)
        print(result["answer"])
        sources = result.get("sources", [])
        if sources:
            print("\nSources:")
            for source in sources:
                print(f"- {source.get('name', 'Source')} ({source.get('url', '')})")
    except Exception as exc:
        print(f"Query error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        engine.close()


if __name__ == "__main__":
    main()
