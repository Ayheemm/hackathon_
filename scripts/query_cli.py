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
    parser.add_argument("--model-path", default="qwen3.5:4b", help="Optional path to GGUF model or Ollama model reference")
    parser.add_argument("--k", type=int, default=5, help="Top-k retrieval")
    parser.add_argument("--min-score", type=float, default=0.35, help="Minimum cosine score")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

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
        print(f"Initialization error: {exc}", file=sys.stderr)
        sys.exit(1)

    try:
        result = engine.answer(query=args.query, k=args.k, min_score=args.min_score)
        if result.get("error"):
            print(f"Warning: {result['error']}", file=sys.stderr)
        print(result["answer"])
    except Exception as exc:
        print(f"Query error: {exc}", file=sys.stderr)
        sys.exit(1)
    finally:
        engine.close()


if __name__ == "__main__":
    main()
