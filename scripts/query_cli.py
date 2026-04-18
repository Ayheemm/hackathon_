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
    parser.add_argument("--model-path", default=None, help="Optional path to GGUF model")
    parser.add_argument("--k", type=int, default=5, help="Top-k retrieval")
    parser.add_argument("--min-score", type=float, default=0.35, help="Minimum cosine score")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    from legal_rag.rag import LegalRagEngine

    paths = ProjectPaths()
    model_path = Path(args.model_path) if args.model_path else None

    engine = LegalRagEngine(
        index_path=paths.faiss_index,
        metadata_db_path=paths.metadata_db,
        model_path=model_path,
    )

    result = engine.answer(query=args.query, k=args.k, min_score=args.min_score)
    print(result["answer"])
    engine.close()


if __name__ == "__main__":
    main()
