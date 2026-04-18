"""
MIZAN Legal RAG — Project Settings & Paths
Drop this file at:  src/legal_rag/settings.py
"""
from pathlib import Path
import os

# ─── Root detection ─────────────────────────────────────────────────────────────
# Works whether the script is run from project root or from src/
_THIS_FILE = Path(__file__).resolve()
_POSSIBLE_ROOTS = [
    _THIS_FILE.parent.parent.parent,   # src/legal_rag/settings.py → project root
    Path(os.getcwd()),                 # fallback: cwd
]
PROJECT_ROOT = next((p for p in _POSSIBLE_ROOTS if (p / "src").exists()), _POSSIBLE_ROOTS[-1])


class ProjectPaths:
    """Centralised path registry for the MIZAN project."""

    def __init__(self, root: Path | None = None):
        self.root = Path(root) if root else PROJECT_ROOT

        # ── Data directories ───────────────────────────────────────────────────
        self.data          = self.root / "data"
        self.raw_html      = self.data / "raw" / "html"
        self.raw_pdfs      = self.data / "raw" / "pdfs"
        self.raw_hf        = self.data / "raw" / "huggingface"
        self.processed     = self.data / "processed"

        # ── Index / DB ─────────────────────────────────────────────────────────
        self.index_dir     = self.root / "index"
        self.faiss_index   = self.index_dir / "mizan.faiss"
        self.metadata_db   = self.index_dir / "metadata.db"
        self.scrape_log    = self.index_dir / "scrape_log.db"

        # ── Models ─────────────────────────────────────────────────────────────
        self.models        = self.root / "models"

        # ── Logs ───────────────────────────────────────────────────────────────
        self.logs          = self.root / "logs"

    def ensure_all(self) -> None:
        """Create all directories that don't exist yet."""
        for attr in vars(self).values():
            if isinstance(attr, Path) and "." not in attr.name:
                attr.mkdir(parents=True, exist_ok=True)

    def __repr__(self) -> str:
        return f"ProjectPaths(root={self.root})"


# Convenience singleton
default_paths = ProjectPaths()
