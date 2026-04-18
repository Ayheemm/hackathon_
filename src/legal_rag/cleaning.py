import json
import re
import unicodedata
from pathlib import Path
from typing import Dict, Iterable, Iterator

from .language import detect_language

ARABIC_DIACRITICS = re.compile(r"[\u0617-\u061A\u064B-\u065F]")
TATWEEL = re.compile(r"\u0640")
MULTISPACE = re.compile(r"\s+")
UNWANTED_FR = re.compile(r"[^\w\sA-Za-z0-9\u00C0-\u017F\.\,\;\:\!\?\-\(\)\[\]\\\"']")


def clean_arabic(text: str) -> str:
    value = ARABIC_DIACRITICS.sub("", text)
    value = TATWEEL.sub("", value)
    value = unicodedata.normalize("NFC", value)
    return MULTISPACE.sub(" ", value).strip()


def clean_french(text: str) -> str:
    value = unicodedata.normalize("NFC", text)
    value = UNWANTED_FR.sub(" ", value)
    return MULTISPACE.sub(" ", value).strip()


def clean_document(doc: Dict[str, str]) -> Dict[str, str]:
    body = doc.get("body", "")
    lang = detect_language(body)
    cleaned = clean_arabic(body) if lang == "ar" else clean_french(body)

    return {
        "id": doc.get("id", ""),
        "url": doc.get("url", ""),
        "title": doc.get("title", "Untitled"),
        "lang": lang,
        "body_clean": cleaned,
    }


def read_jsonl(path: Path) -> Iterator[Dict[str, str]]:
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def write_jsonl(path: Path, docs: Iterable[Dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8") as handle:
        for doc in docs:
            handle.write(json.dumps(doc, ensure_ascii=False) + "\n")


def clean_dataset(raw_path: Path, clean_path: Path, min_chars: int = 120) -> int:
    kept = 0
    cleaned_docs = []

    for raw_doc in read_jsonl(raw_path):
        body = raw_doc.get("body", "")
        if len(body) < min_chars:
            continue

        cleaned = clean_document(raw_doc)
        if not cleaned["body_clean"]:
            continue

        cleaned_docs.append(cleaned)
        kept += 1

    write_jsonl(clean_path, cleaned_docs)
    return kept
