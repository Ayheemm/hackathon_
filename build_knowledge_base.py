#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════╗
║  MIZAN LEGAL RAG — Knowledge Base Builder                    ║
║  build_knowledge_base.py                                     ║
║                                                              ║
║  Usage:                                                      ║
║    python build_knowledge_base.py                            ║
║    python build_knowledge_base.py --phase 1                  ║
║    python build_knowledge_base.py --source 9anoun            ║
║    python build_knowledge_base.py --reset                    ║
╚══════════════════════════════════════════════════════════════╝

Scrapes all verified Tunisian legal sources and writes:
  • data/raw/         — downloaded HTML / PDFs
  • index/mizan.faiss — FAISS vector index (IndexFlatIP)
  • index/metadata.db — chunk metadata (SQLite)
  • index/scrape_log.db — progress / resume log (SQLite)

Stack matches hackathon_current_stats.txt:
  Embeddings : Ollama  nomic-embed-text-v2-moe  (localhost:11434)
  Chunker    : src/legal_rag/chunking.py
  Vector DB  : faiss-cpu (IndexFlatIP, normalised vectors)
  Language   : src/legal_rag/language.py
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import logging
import sqlite3
import sys
import time
from pathlib import Path
from typing import Generator
from urllib.parse import urljoin, urlparse

import faiss
import numpy as np
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm

# ─── Project path bootstrapping ─────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from legal_rag.chunking import chunk_text
from legal_rag.embeddings import OllamaEmbedder
from legal_rag.language import detect_language

# ─── Logging ─────────────────────────────────────────────────────────────────

(ROOT / "logs").mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(ROOT / "logs" / "build_kb.log", mode="a"),
    ],
)
log = logging.getLogger("mizan.builder")

# ─── Paths ───────────────────────────────────────────────────────────────────

DATA_DIR   = ROOT / "data"
RAW_HTML   = DATA_DIR / "raw" / "html"
RAW_PDFS   = DATA_DIR / "raw" / "pdfs"
INDEX_DIR  = ROOT / "index"
LOG_DIR    = ROOT / "logs"

FAISS_PATH = INDEX_DIR / "mizan.faiss"
META_DB    = INDEX_DIR / "metadata.db"
LOG_DB     = INDEX_DIR / "scrape_log.db"

for _d in (RAW_HTML, RAW_PDFS, INDEX_DIR, LOG_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ─── Constants ───────────────────────────────────────────────────────────────

EMBED_MODEL  = "nomic-embed-text-v2-moe:latest"
EMBED_DIM    = 768          # nomic-embed-text-v2-moe default output dimension
CHUNK_SIZE   = 400          # words
CHUNK_OVERLAP = 80          # words
MIN_CHUNK    = 80           # chars — shorter chunks discarded

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0 Safari/537.36"
    ),
    "Accept-Language": "fr-TN,fr;q=0.9,ar;q=0.8,en;q=0.7",
}
REQUEST_TIMEOUT  = 30   # seconds per request
REQUEST_DELAY    = 1.5  # polite crawl delay (seconds)


# ═══════════════════════════════════════════════════════════════════════════════
# SOURCE REGISTRY
# ═══════════════════════════════════════════════════════════════════════════════

SOURCES = [

    # ── Phase 1 : Direct PDF Downloads (fastest, no JS) ──────────────────────
    {
        "id": "coc_bna",
        "name": "Code des Obligations et Contrats (BNA)",
        "url": "http://www.bna.tn/documents/Code_des_obligations_et_des_contrats.pdf",
        "type": "pdf_direct",
        "language": "fr",
        "phase": 1,
        "priority": 1,
        "tags": ["code", "obligations", "contrats", "COC"],
    },
    {
        "id": "code_societes_cmf",
        "name": "Code des Sociétés Commerciales (CMF)",
        "url": "https://www.cmf.tn/sites/default/files/pdfs/reglementation/textes-reference/code_societes_fr.pdf",
        "type": "pdf_direct",
        "language": "fr",
        "phase": 1,
        "priority": 1,
        "tags": ["code", "sociétés", "commerce"],
    },
    {
        "id": "constitution_2022_ar",
        "name": "Constitution 2022 (Arabe, Présidence)",
        "url": "https://pm.gov.tn/sites/default/files/2023-03/constitution-2022.pdf",
        "type": "pdf_direct",
        "language": "ar",
        "phase": 1,
        "priority": 1,
        "tags": ["constitution", "2022"],
    },
    {
        "id": "dcaf_index_pdf",
        "name": "DCAF Tunisia Legal Collection Index 1956–2011",
        "url": "https://www.dcaf.ch/sites/default/files/publications/documents/Tunisia_legal_collection.pdf",
        "type": "pdf_direct",
        "language": "fr",
        "phase": 1,
        "priority": 2,
        "tags": ["index", "DCAF", "législation"],
    },
    {
        "id": "code_droits_reels_bna",
        "name": "Code des Droits Réels (BNA)",
        "url": "http://www.bna.tn/documents/Tunisie_Code_2011_droits_reels.pdf",
        "type": "pdf_direct",
        "language": "fr",
        "phase": 1,
        "priority": 2,
        "tags": ["code", "droits réels", "immobilier"],
    },

    # ── Phase 1 : 9anoun.tn — cleanest article-level HTML ────────────────────
    {
        "id": "9anoun_codes",
        "name": "9anoun.tn — Codes Juridiques",
        "url": "https://9anoun.tn/fr/kb/codes",
        "type": "html_9anoun",
        "language": "fr",
        "phase": 1,
        "priority": 1,
        "tags": ["codes", "9anoun"],
    },
    {
        "id": "9anoun_lexi",
        "name": "9anoun.tn — Lexique Juridique",
        "url": "https://9anoun.tn/fr/lexi",
        "type": "html_9anoun_lexi",
        "language": "fr",
        "phase": 1,
        "priority": 2,
        "tags": ["lexique", "glossaire", "9anoun"],
    },

    # ── Phase 2 : JurisiteTunisie.com ─────────────────────────────────────────
    {
        "id": "jurisite_codes",
        "name": "JurisiteTunisie.com — Codes Juridiques",
        "url": "https://www.jurisitetunisie.com/textes/touslestextes_touslescodes.html",
        "type": "html_jurisite",
        "language": "fr",
        "phase": 2,
        "priority": 1,
        "tags": ["codes", "jurisite"],
    },

    # ── Phase 2 : legislation-securite.tn (DCAF) ──────────────────────────────
    {
        "id": "legislation_securite",
        "name": "legislation-securite.tn — DCAF Base Juridique",
        "url": "https://legislation-securite.tn/latest-laws/",
        "type": "html_legislation_securite",
        "language": "fr",
        "phase": 2,
        "priority": 1,
        "tags": ["sécurité", "DCAF", "législation"],
    },

    # ── Phase 2 : Ministère de la Justice ────────────────────────────────────
    {
        "id": "justice_codes",
        "name": "Ministère de la Justice — Codes Juridiques",
        "url": "https://www.justice.gov.tn/index.php?id=223&L=3",
        "type": "html_justice_gov",
        "language": "fr",
        "phase": 2,
        "priority": 1,
        "tags": ["ministère", "justice", "codes"],
    },

    # ── Phase 2 : Juricaf — Court decisions ──────────────────────────────────
    {
        "id": "juricaf_tunisia",
        "name": "Juricaf — Arrêts Cour de Cassation Tunisie",
        "url": "https://juricaf.org/recherche/+/facet_pays:Tunisie",
        "type": "html_juricaf",
        "language": "fr",
        "phase": 2,
        "priority": 2,
        "tags": ["jurisprudence", "cassation", "arrêts"],
    },

    # ── Phase 2 : FAO FAOLEX ─────────────────────────────────────────────────
    {
        "id": "faolex_tunisia",
        "name": "FAO FAOLEX — Profil Juridique Tunisie",
        "url": "https://www.fao.org/faolex/country-profiles/general-profile/en/?iso3=TUN",
        "type": "html_faolex",
        "language": "en",
        "phase": 2,
        "priority": 2,
        "tags": ["agriculture", "environnement", "FAOLEX"],
    },

    # ── Phase 3 : diwan.tn ────────────────────────────────────────────────────
    {
        "id": "diwan_codes",
        "name": "Diwan.tn — Codes Officiels 2024",
        "url": "https://www.diwan.tn/fr/document/",
        "type": "html_diwan",
        "language": "fr",
        "phase": 3,
        "priority": 1,
        "tags": ["codes", "2024", "officiel"],
    },

    # ── Phase 3 : HuggingFace datasets (zero-scraping, max impact) ───────────
    {
        "id": "hf_tunisia_law",
        "name": "HuggingFace — nada-ghazouani/tunisia-law",
        "url": "https://huggingface.co/datasets/nada-ghazouani/tunisia-law",
        "type": "huggingface",
        "hf_repo": "nada-ghazouani/tunisia-law",
        "hf_split": "train",
        "hf_text_field": "text",
        "language": "fr",
        "phase": 3,
        "priority": 1,
        "tags": ["HuggingFace", "tunisie", "loi"],
    },
    {
        "id": "hf_egypt_legal",
        "name": "HuggingFace — dataflare/egypt-legal-corpus",
        "url": "https://huggingface.co/datasets/dataflare/egypt-legal-corpus",
        "type": "huggingface",
        "hf_repo": "dataflare/egypt-legal-corpus",
        "hf_split": "train",
        "hf_text_field": "text",
        "language": "ar",
        "phase": 3,
        "priority": 2,
        "tags": ["HuggingFace", "égypte", "arabe"],
    },
    {
        "id": "hf_mizan_qa",
        "name": "HuggingFace — adlbh/MizanQA-v0",
        "url": "https://huggingface.co/datasets/adlbh/MizanQA-v0",
        "type": "huggingface",
        "hf_repo": "adlbh/MizanQA-v0",
        "hf_split": "train",
        "hf_text_field": "question",
        "language": "ar",
        "phase": 3,
        "priority": 2,
        "tags": ["HuggingFace", "QA", "Maghreb", "évaluation"],
    },
    {
        "id": "hf_banking_qa",
        "name": "HuggingFace — MedAliFarhat/Tunisia-Banking-Compliance-qa",
        "url": "https://huggingface.co/datasets/MedAliFarhat/Tunisia-Banking-Compliance-qa",
        "type": "huggingface",
        "hf_repo": "MedAliFarhat/Tunisia-Banking-Compliance-qa",
        "hf_split": "train",
        "hf_text_field": "answer",
        "language": "fr",
        "phase": 3,
        "priority": 2,
        "tags": ["HuggingFace", "banque", "compliance", "BCT"],
    },
]


# ═══════════════════════════════════════════════════════════════════════════════
# DATABASE LAYER
# ═══════════════════════════════════════════════════════════════════════════════

def init_databases() -> tuple[sqlite3.Connection, sqlite3.Connection]:
    """Create and return (meta_db, log_db) connections with schema."""

    # Metadata DB — stores chunk text + FAISS mapping
    meta = sqlite3.connect(str(META_DB), check_same_thread=False)
    meta.execute("""
        CREATE TABLE IF NOT EXISTS chunks (
            faiss_id    INTEGER PRIMARY KEY,
            source_id   TEXT NOT NULL,
            source_name TEXT NOT NULL,
            source_url  TEXT NOT NULL,
            language    TEXT NOT NULL,
            chunk_text  TEXT NOT NULL,
            chunk_hash  TEXT NOT NULL,
            tags        TEXT DEFAULT '[]',
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)
    meta.execute("CREATE INDEX IF NOT EXISTS idx_source ON chunks(source_id)")
    meta.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_hash ON chunks(chunk_hash)")
    meta.commit()

    # Scrape log DB — tracks what's been processed (resume support)
    log = sqlite3.connect(str(LOG_DB), check_same_thread=False)
    log.execute("""
        CREATE TABLE IF NOT EXISTS scrape_log (
            source_id   TEXT PRIMARY KEY,
            status      TEXT NOT NULL,   -- 'done' | 'error' | 'partial'
            chunks_added INTEGER DEFAULT 0,
            error_msg   TEXT,
            completed_at TEXT DEFAULT (datetime('now'))
        )
    """)
    log.commit()

    return meta, log


def chunk_is_known(meta: sqlite3.Connection, chunk_hash: str) -> bool:
    row = meta.execute(
        "SELECT 1 FROM chunks WHERE chunk_hash = ?", (chunk_hash,)
    ).fetchone()
    return row is not None


def insert_chunk(
    meta: sqlite3.Connection,
    faiss_id: int,
    source: dict,
    text: str,
    language: str,
) -> None:
    h = hashlib.sha1(text.encode()).hexdigest()
    meta.execute(
        """INSERT OR IGNORE INTO chunks
           (faiss_id, source_id, source_name, source_url, language, chunk_text, chunk_hash, tags)
           VALUES (?,?,?,?,?,?,?,?)""",
        (faiss_id, source["id"], source["name"], source["url"],
         language, text, h, json.dumps(source.get("tags", []))),
    )


def mark_done(log: sqlite3.Connection, source_id: str, chunks: int) -> None:
    log.execute(
        """INSERT OR REPLACE INTO scrape_log (source_id, status, chunks_added)
           VALUES (?, 'done', ?)""",
        (source_id, chunks),
    )
    log.commit()


def mark_error(log: sqlite3.Connection, source_id: str, msg: str) -> None:
    log.execute(
        """INSERT OR REPLACE INTO scrape_log (source_id, status, error_msg)
           VALUES (?, 'error', ?)""",
        (source_id, str(msg)[:500]),
    )
    log.commit()


def is_done(log: sqlite3.Connection, source_id: str) -> bool:
    row = log.execute(
        "SELECT status FROM scrape_log WHERE source_id = ?", (source_id,)
    ).fetchone()
    return row is not None and row[0] == "done"


# ═══════════════════════════════════════════════════════════════════════════════
# FAISS INDEX MANAGER
# ═══════════════════════════════════════════════════════════════════════════════

class FaissIndex:
    """Wraps a FAISS IndexFlatIP and exposes add / save / load."""

    def __init__(self, dim: int = EMBED_DIM):
        self.dim = dim
        if FAISS_PATH.exists():
            self.index = faiss.read_index(str(FAISS_PATH))
            log.info(f"Resumed FAISS index — {self.index.ntotal} vectors already stored")
        else:
            self.index = faiss.IndexFlatIP(dim)   # inner product (cosine on L2-normed vecs)
            log.info(f"Created new FAISS IndexFlatIP (dim={dim})")

    def add(self, vectors: np.ndarray) -> list[int]:
        """Add L2-normalised vectors, return list of assigned FAISS IDs."""
        start = self.index.ntotal
        faiss.normalize_L2(vectors)
        self.index.add(vectors)
        return list(range(start, self.index.ntotal))

    def save(self) -> None:
        faiss.write_index(self.index, str(FAISS_PATH))
        log.info(f"FAISS index saved - {self.index.ntotal} total vectors -> {FAISS_PATH}")

    @property
    def total(self) -> int:
        return self.index.ntotal


# ═══════════════════════════════════════════════════════════════════════════════
# EMBEDDING PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def get_embedder() -> OllamaEmbedder:
    """Connect to Ollama embedder; raise a clear error if Ollama is down."""
    emb = OllamaEmbedder(model_name=EMBED_MODEL)
    try:
        test = emb.encode(["test"], normalize_embeddings=True)
        dim = test.shape[1]
        if dim != EMBED_DIM:
            log.warning(
                f"Embedding dim mismatch: expected {EMBED_DIM}, got {dim}. "
                "Update EMBED_DIM constant at top of this script."
            )
    except Exception as e:
        raise RuntimeError(
            f"\n\nERROR: Cannot reach Ollama embedding model.\n"
            f"    Make sure Ollama is running:  ollama serve\n"
            f"    And the model is pulled:      ollama pull {EMBED_MODEL}\n"
            f"    Error: {e}\n"
        )
    log.info(f"Ollama embedder ready - model: {EMBED_MODEL}  dim: {dim}")
    return emb


def embed_and_index(
    chunks: list[str],
    source: dict,
    languages: list[str],
    embedder: OllamaEmbedder,
    fi: FaissIndex,
    meta: sqlite3.Connection,
    batch_size: int = 32,
) -> int:
    """Embed chunks in batches, add to FAISS, persist metadata. Returns new chunk count."""
    added = 0
    for i in range(0, len(chunks), batch_size):
        batch_texts = chunks[i : i + batch_size]
        batch_langs = languages[i : i + batch_size]

        # Skip duplicates
        new_texts, new_langs = [], []
        for t, l in zip(batch_texts, batch_langs):
            h = hashlib.sha1(t.encode()).hexdigest()
            if not chunk_is_known(meta, h):
                new_texts.append(t)
                new_langs.append(l)

        if not new_texts:
            continue

        try:
            vecs = embedder.encode(new_texts, normalize_embeddings=True).astype("float32")
        except Exception as e:
            log.error(f"Embedding failed for batch starting at {i}: {e}")
            continue

        if vecs.shape[1] != fi.dim:
            log.warning(f"Dim mismatch ({vecs.shape[1]} vs {fi.dim}), padding/truncating")
            if vecs.shape[1] > fi.dim:
                vecs = vecs[:, :fi.dim]
            else:
                pad = np.zeros((vecs.shape[0], fi.dim - vecs.shape[1]), dtype="float32")
                vecs = np.hstack([vecs, pad])

        ids = fi.add(vecs)
        for fid, txt, lang in zip(ids, new_texts, new_langs):
            insert_chunk(meta, fid, source, txt, lang)
        meta.commit()
        added += len(new_texts)

    return added


# ═══════════════════════════════════════════════════════════════════════════════
# TEXT EXTRACTION UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def extract_pdf_text(pdf_bytes: bytes) -> str:
    """Try pdfplumber → pymupdf → fallback with a clear install hint."""
    # 1. pdfplumber (pip install pdfplumber)
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            pages = [p.extract_text() or "" for p in pdf.pages]
        text = "\n".join(pages)
        if len(text.strip()) > 100:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    # 2. PyMuPDF / fitz (pip install pymupdf)
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc)
        if len(text.strip()) > 100:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    # 3. pypdf (pip install pypdf)
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
        text = "\n".join(p.extract_text() or "" for p in reader.pages)
        if len(text.strip()) > 100:
            return text
    except ImportError:
        pass
    except Exception:
        pass

    log.warning(
        "WARNING: No PDF parser available. Install one:\n"
        "    pip install pdfplumber      (recommended)\n"
        "    pip install pymupdf         (fastest)\n"
        "    pip install pypdf           (pure-Python)\n"
        "PDF content skipped."
    )
    return ""


def clean_html_text(soup: BeautifulSoup) -> str:
    """Remove scripts/styles, return plain text."""
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    return soup.get_text(separator="\n", strip=True)


def chunks_from_text(text: str, source_lang: str) -> tuple[list[str], list[str]]:
    """Run chunking + per-chunk language detection. Returns (texts, langs)."""
    raw = chunk_text(text, chunk_size=CHUNK_SIZE, overlap=CHUNK_OVERLAP, min_chars=MIN_CHUNK)
    langs = [detect_language(c) if source_lang == "auto" else source_lang for c in raw]
    return raw, langs


def safe_get(url: str, **kw) -> requests.Response | None:
    """GET with retry + politeness delay."""
    time.sleep(REQUEST_DELAY)
    try:
        r = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT, **kw)
        r.raise_for_status()
        return r
    except requests.RequestException as e:
        log.warning(f"GET {url} -> {e}")
        return None


# ═══════════════════════════════════════════════════════════════════════════════
# SCRAPERS (one per source type)
# ═══════════════════════════════════════════════════════════════════════════════

def scrape_pdf_direct(source: dict) -> Generator[tuple[str, str], None, None]:
    """Download a single PDF and yield (text, language) pairs."""
    url = source["url"]
    slug = source["id"]
    dest = RAW_PDFS / f"{slug}.pdf"

    if dest.exists():
        log.info(f"  PDF cached: {dest.name}")
        pdf_bytes = dest.read_bytes()
    else:
        log.info(f"  Downloading PDF: {url}")
        r = safe_get(url)
        if not r:
            return
        pdf_bytes = r.content
        dest.write_bytes(pdf_bytes)
        log.info(f"  Saved -> {dest.name} ({len(pdf_bytes)//1024} KB)")

    text = extract_pdf_text(pdf_bytes)
    if text.strip():
        yield text, source.get("language", "fr")
    else:
        log.warning(f"  No text extracted from {slug}.pdf - may need OCR (medgemma)")


# ── 9anoun.tn ─────────────────────────────────────────────────────────────────

def scrape_9anoun_codes(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape all code articles from 9anoun.tn."""
    index_url = source["url"]
    r = safe_get(index_url)
    if not r:
        return

    soup = BeautifulSoup(r.text, "lxml")
    # Find code index links (pattern: /fr/kb/codes/{slug})
    code_links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/fr/kb/codes/" in href and href.count("/") >= 4:
            full = urljoin("https://9anoun.tn", href)
            code_links.add(full)

    log.info(f"  9anoun.tn - found {len(code_links)} code pages")

    for code_url in sorted(code_links)[:30]:   # cap at 30 codes for hackathon
        r2 = safe_get(code_url)
        if not r2:
            continue
        soup2 = BeautifulSoup(r2.text, "lxml")
        text = clean_html_text(soup2)
        if len(text) > 200:
            yield text, "fr"
            # Also try to find article sub-pages
            for a in soup2.find_all("a", href=True):
                if "article" in a["href"].lower():
                    art_url = urljoin("https://9anoun.tn", a["href"])
                    r3 = safe_get(art_url)
                    if r3:
                        s3 = BeautifulSoup(r3.text, "lxml")
                        art_text = clean_html_text(s3)
                        if len(art_text) > 100:
                            yield art_text, "fr"


def scrape_9anoun_lexi(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape the 9anoun.tn legal lexicon (bilingual glossary)."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")
    text = clean_html_text(soup)
    if text.strip():
        yield text, "fr"


# ── JurisiteTunisie.com ───────────────────────────────────────────────────────

def scrape_jurisite(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape code texts from jurisitetunisie.com."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")

    code_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.endswith(".htm") or href.endswith(".html"):
            full = urljoin("https://www.jurisitetunisie.com", href)
            if "jurisitetunisie" in full:
                code_links.append(full)

    log.info(f"  JurisiteTunisie — found {len(code_links)} pages")

    for url in code_links[:50]:
        r2 = safe_get(url)
        if not r2:
            continue
        soup2 = BeautifulSoup(r2.text, "lxml")
        text = clean_html_text(soup2)
        if len(text) > 300:
            yield text, "fr"


# ── legislation-securite.tn ───────────────────────────────────────────────────

def scrape_legislation_securite(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape recent laws from legislation-securite.tn."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")
    text = clean_html_text(soup)
    if text.strip():
        yield text, "fr"

    # Follow law links on the page
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "legislation-securite.tn" in href or href.startswith("/"):
            full = urljoin("https://legislation-securite.tn", href)
            if full == source["url"]:
                continue
            r2 = safe_get(full)
            if r2:
                s2 = BeautifulSoup(r2.text, "lxml")
                t2 = clean_html_text(s2)
                if len(t2) > 300:
                    yield t2, "auto"


# ── justice.gov.tn ────────────────────────────────────────────────────────────

def scrape_justice_gov(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape code pages from Ministry of Justice."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")
    text = clean_html_text(soup)
    if text.strip():
        yield text, "fr"

    # Follow links to individual code pages
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "justice.gov.tn" in href or (href.startswith("?") and "id=" in href):
            full = urljoin("https://www.justice.gov.tn", href)
            r2 = safe_get(full)
            if r2:
                s2 = BeautifulSoup(r2.text, "lxml")
                t2 = clean_html_text(s2)
                if len(t2) > 300:
                    yield t2, "auto"


# ── juricaf.org ───────────────────────────────────────────────────────────────

def scrape_juricaf(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape Tunisian court decisions from Juricaf."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")
    text = clean_html_text(soup)
    if text.strip():
        yield text, "fr"

    # Follow decision links
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/arret/" in href or "/decision/" in href:
            full = urljoin("https://juricaf.org", href)
            r2 = safe_get(full)
            if r2:
                s2 = BeautifulSoup(r2.text, "lxml")
                t2 = clean_html_text(s2)
                if len(t2) > 200:
                    yield t2, "fr"


# ── fao.org/faolex ────────────────────────────────────────────────────────────

def scrape_faolex(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape FAO FAOLEX Tunisia profile."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")
    text = clean_html_text(soup)
    if text.strip():
        yield text, "en"


# ── diwan.tn ─────────────────────────────────────────────────────────────────

def scrape_diwan(source: dict) -> Generator[tuple[str, str], None, None]:
    """Scrape document links from diwan.tn and download PDFs."""
    r = safe_get(source["url"])
    if not r:
        return
    soup = BeautifulSoup(r.text, "lxml")

    pdf_links = [
        urljoin("https://www.diwan.tn", a["href"])
        for a in soup.find_all("a", href=True)
        if a["href"].endswith(".pdf")
    ]
    log.info(f"  diwan.tn — found {len(pdf_links)} PDFs")

    for pdf_url in pdf_links[:10]:
        r2 = safe_get(pdf_url)
        if not r2:
            continue
        text = extract_pdf_text(r2.content)
        if text.strip():
            yield text, "fr"


# ── HuggingFace datasets ──────────────────────────────────────────────────────

def scrape_huggingface(source: dict) -> Generator[tuple[str, str], None, None]:
    """Load a HuggingFace dataset and yield text rows."""
    try:
        from datasets import load_dataset  # pip install datasets
    except ImportError:
        log.warning(
            f"  'datasets' package not installed. Skipping {source['id']}.\n"
            "  Install with: pip install datasets"
        )
        return

    repo = source["hf_repo"]
    split = source.get("hf_split", "train")
    field = source.get("hf_text_field", "text")
    lang  = source.get("language", "fr")

    log.info(f"  Loading HuggingFace dataset: {repo}")
    try:
        ds = load_dataset(repo, split=split, trust_remote_code=True)
    except Exception as e:
        log.warning(f"  Could not load {repo}: {e}")
        return

    # Determine text column
    if field not in ds.column_names:
        candidates = [c for c in ds.column_names if "text" in c.lower() or "content" in c.lower()]
        if not candidates:
            log.warning(f"  No text column found in {repo}. Columns: {ds.column_names}")
            return
        field = candidates[0]
        log.info(f"  Using column '{field}' from {repo}")

    log.info(f"  {repo} — {len(ds)} rows, using column '{field}'")

    # Stream rows to avoid memory issues
    for row in tqdm(ds, desc=f"  {repo}", total=len(ds), leave=False):
        text = str(row.get(field, "") or "")
        # For QA datasets, combine question + answer
        if "question" in row and "answer" in row:
            text = f"Q: {row['question']}\nA: {row.get('answer', '')}"
        if len(text.strip()) > MIN_CHUNK:
            yield text, lang


# ─── Dispatcher ──────────────────────────────────────────────────────────────

SCRAPER_MAP = {
    "pdf_direct":              scrape_pdf_direct,
    "html_9anoun":             scrape_9anoun_codes,
    "html_9anoun_lexi":        scrape_9anoun_lexi,
    "html_jurisite":           scrape_jurisite,
    "html_legislation_securite": scrape_legislation_securite,
    "html_justice_gov":        scrape_justice_gov,
    "html_juricaf":            scrape_juricaf,
    "html_faolex":             scrape_faolex,
    "html_diwan":              scrape_diwan,
    "huggingface":             scrape_huggingface,
}


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def process_source(
    source: dict,
    embedder: OllamaEmbedder,
    fi: FaissIndex,
    meta: sqlite3.Connection,
    log_db: sqlite3.Connection,
    force: bool = False,
) -> int:
    """Scrape -> chunk -> embed -> index one source. Returns chunks added."""
    sid = source["id"]

    if not force and is_done(log_db, sid):
        log.info(f"  Skipping {sid} (already done - use --reset to re-index)")
        return 0

    scraper = SCRAPER_MAP.get(source["type"])
    if not scraper:
        log.warning(f"  WARNING: No scraper for type '{source['type']}' - skipping {sid}")
        return 0

    log.info(f"\n{'-'*60}")
    log.info(f"  RUNNING: {source['name']}")
    log.info(f"     type={source['type']}  phase={source['phase']}")

    total_chunks_added = 0
    try:
        for raw_text, lang in scraper(source):
            if not raw_text or not raw_text.strip():
                continue
            chunks, langs = chunks_from_text(raw_text, lang)
            if not chunks:
                continue
            added = embed_and_index(chunks, source, langs, embedder, fi, meta)
            total_chunks_added += added
            log.info(f"     +{added} chunks embedded (running total: {fi.total})")

        mark_done(log_db, sid, total_chunks_added)
        fi.save()  # Save after every source for crash safety
        log.info(f"  DONE: {sid} - {total_chunks_added} new chunks indexed")

    except KeyboardInterrupt:
        log.warning(f"  INTERRUPTED at {sid} - partial progress saved")
        mark_error(log_db, sid, "KeyboardInterrupt")
        raise
    except Exception as e:
        log.error(f"  FAILED: {sid} error: {e}", exc_info=True)
        mark_error(log_db, sid, str(e))

    return total_chunks_added


def print_summary(log_db: sqlite3.Connection, fi: FaissIndex) -> None:
    rows = log_db.execute(
        "SELECT source_id, status, chunks_added FROM scrape_log ORDER BY source_id"
    ).fetchall()
    print("\n" + "=" * 60)
    print("  MIZAN BUILD SUMMARY")
    print("=" * 60)
    for r in rows:
        icon = "OK" if r[1] == "done" else ("ERR" if r[1] == "error" else "~")
        print(f"  {icon}  {r[0]:35s}  {r[2]:>5} chunks")
    print("-" * 60)
    print(f"  TOTAL VECTORS IN FAISS INDEX: {fi.total}")
    print("=" * 60 + "\n")


# ═══════════════════════════════════════════════════════════════════════════════
# CLI ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="MIZAN - Build the legal knowledge base (FAISS + SQLite)"
    )
    parser.add_argument(
        "--phase", type=int, choices=[1, 2, 3],
        help="Run only sources of this phase (1=fastest, 3=slowest)"
    )
    parser.add_argument(
        "--source", type=str,
        help="Run a single source by ID (e.g. --source 9anoun_codes)"
    )
    parser.add_argument(
        "--reset", action="store_true",
        help="Ignore the scrape log and re-index everything from scratch"
    )
    parser.add_argument(
        "--list", action="store_true",
        help="List all sources and exit"
    )
    parser.add_argument(
        "--embed-dim", type=int, default=EMBED_DIM,
        help=f"Embedding dimension (default: {EMBED_DIM})"
    )
    args = parser.parse_args()

    if args.list:
        print("\nAll registered sources:")
        for s in sorted(SOURCES, key=lambda x: (x["phase"], x["priority"])):
            print(f"  Phase {s['phase']} | P{s['priority']} | {s['id']:35s} | {s['type']}")
        return

    # ── Setup ────────────────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  MIZAN - Legal Knowledge Base Builder")
    print("  Stack: OllamaEmbedder + FAISS + SQLite")
    print("=" * 60 + "\n")

    if args.reset:
        log.warning("--reset flag: clearing FAISS index and scrape log")
        FAISS_PATH.unlink(missing_ok=True)
        LOG_DB.unlink(missing_ok=True)

    meta_db, log_db = init_databases()
    fi = FaissIndex(dim=args.embed_dim)

    log.info("Connecting to Ollama embedder…")
    embedder = get_embedder()

    # ── Source selection ─────────────────────────────────────────────────────
    if args.source:
        selected = [s for s in SOURCES if s["id"] == args.source]
        if not selected:
            print(f"ERROR: Unknown source ID: '{args.source}'")
            print("   Run --list to see all IDs.")
            sys.exit(1)
    elif args.phase:
        selected = [s for s in SOURCES if s["phase"] == args.phase]
    else:
        selected = SOURCES

    # Sort by phase -> priority
    selected = sorted(selected, key=lambda x: (x["phase"], x["priority"]))
    log.info(f"Processing {len(selected)} sources...\n")

    # ── Process ──────────────────────────────────────────────────────────────
    grand_total = 0
    try:
        for source in selected:
            n = process_source(source, embedder, fi, meta_db, log_db, force=args.reset)
            grand_total += n
    except KeyboardInterrupt:
        log.warning("\nBuild interrupted by user. Progress has been saved.")
        log.warning("    Re-run without --reset to resume from where you left off.")

    # ── Final save + summary ─────────────────────────────────────────────────
    fi.save()
    meta_db.commit()
    meta_db.close()
    log_db.close()

    log.info(f"\nBuild complete. Total new chunks added this run: {grand_total}")
    log.info(f"    FAISS index -> {FAISS_PATH}")
    log.info(f"    Metadata DB -> {META_DB}")
    print_summary(
        sqlite3.connect(str(LOG_DB)),
        fi,
    )


if __name__ == "__main__":
    main()
