from dataclasses import dataclass
from pathlib import Path
from typing import Optional


DEFAULT_START_URL = "https://www.justice.gov.tn/index.php?id=223"
DEFAULT_EMBEDDING_MODEL = "nomic-embed-text-v2-moe"
DEFAULT_CHAT_MODEL = "qwen3.5:4b"
DEFAULT_VISION_MODEL = "medgemma:4b"


@dataclass(frozen=True)
class ProjectPaths:
    root: Path = Path(__file__).resolve().parents[2]
    data_raw: Path = root / "data" / "raw"
    data_processed: Path = root / "data" / "processed"
    models: Path = root / "models"
    raw_jsonl: Path = data_raw / "legal_raw.jsonl"
    clean_jsonl: Path = data_processed / "legal_clean.jsonl"
    faiss_index: Path = data_processed / "legal_index.faiss"
    metadata_db: Path = data_processed / "legal_metadata.db"


def ensure_project_dirs(paths: Optional[ProjectPaths] = None) -> ProjectPaths:
    current = paths or ProjectPaths()
    current.data_raw.mkdir(parents=True, exist_ok=True)
    current.data_processed.mkdir(parents=True, exist_ok=True)
    current.models.mkdir(parents=True, exist_ok=True)
    return current
