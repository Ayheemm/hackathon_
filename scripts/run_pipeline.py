import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from legal_rag.settings import DEFAULT_START_URL, ProjectPaths, ensure_project_dirs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run full bilingual legal RAG data pipeline")
    parser.add_argument("--start-url", default=DEFAULT_START_URL, help="Seed URL for legal website crawling")
    parser.add_argument("--max-pages", type=int, default=120, help="Maximum pages to crawl")
    parser.add_argument("--delay", type=float, default=1.5, help="Delay between HTTP requests in seconds")
    parser.add_argument("--skip-scrape", action="store_true", help="Skip scraping and reuse existing raw JSONL")
    parser.add_argument("--skip-clean", action="store_true", help="Skip cleaning and reuse existing clean JSONL")
    parser.add_argument("--embedding-model", default=None, help="Override sentence-transformers model")
    parser.add_argument("--chunk-size", type=int, default=400, help="Chunk size in words")
    parser.add_argument("--chunk-overlap", type=int, default=80, help="Chunk overlap in words")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    from legal_rag.cleaning import clean_dataset
    from legal_rag.indexer import IndexConfig, build_index
    from legal_rag.scraper import ScrapeConfig, scrape_justice_site

    paths: ProjectPaths = ensure_project_dirs()

    if not args.skip_scrape:
        print("[1/3] Scraping legal texts...")
        scrape_config = ScrapeConfig(
            start_url=args.start_url,
            max_pages=args.max_pages,
            delay_seconds=args.delay,
        )
        saved = scrape_justice_site(paths.raw_jsonl, scrape_config)
        print(f"Saved {saved} raw pages to {paths.raw_jsonl}")
    else:
        print("[1/3] Scrape skipped")

    if not args.skip_clean:
        print("[2/3] Cleaning legal texts...")
        kept = clean_dataset(paths.raw_jsonl, paths.clean_jsonl)
        print(f"Kept {kept} clean pages in {paths.clean_jsonl}")
    else:
        print("[2/3] Cleaning skipped")

    print("[3/3] Building FAISS index...")
    index_config = IndexConfig(
        embedding_model_name=args.embedding_model or IndexConfig().embedding_model_name,
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )
    chunk_count = build_index(
        clean_jsonl=paths.clean_jsonl,
        faiss_index_path=paths.faiss_index,
        metadata_db=paths.metadata_db,
        config=index_config,
    )

    print(f"Indexed {chunk_count} chunks")
    print("Pipeline complete")
    print(f"FAISS index: {paths.faiss_index}")
    print(f"Metadata DB: {paths.metadata_db}")


if __name__ == "__main__":
    main()
