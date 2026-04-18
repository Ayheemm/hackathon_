import hashlib
import json
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Deque, Dict, List, Optional, Set
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from tqdm import tqdm


DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
CONTENT_SELECTORS = [
    "div.content",
    "div.article-body",
    "article",
    "main",
]
TITLE_SELECTORS = ["h1", "h2", "title"]


@dataclass(frozen=True)
class ScrapeConfig:
    start_url: str
    max_pages: int = 120
    delay_seconds: float = 1.5
    timeout_seconds: int = 20
    min_body_chars: int = 200


def _canonicalize_url(url: str) -> str:
    clean, _ = urldefrag(url)
    return clean.strip()


def _is_same_domain(url: str, domain: str) -> bool:
    netloc = urlparse(url).netloc.lower().removeprefix("www.")
    domain_norm = domain.lower().removeprefix("www.")
    return netloc == domain_norm


def _is_legal_page_candidate(url: str, domain: str) -> bool:
    parsed = urlparse(url)
    if not _is_same_domain(url, domain):
        return False

    query = parsed.query.lower()
    if "id=" in query:
        return True

    if parsed.path.lower().endswith(".php"):
        return True

    return False


def _extract_title(soup: BeautifulSoup) -> str:
    for selector in TITLE_SELECTORS:
        node = soup.select_one(selector)
        if node:
            text = node.get_text(" ", strip=True)
            if text:
                return text
    return "Untitled"


def _extract_body(soup: BeautifulSoup, min_chars: int) -> str:
    for selector in CONTENT_SELECTORS:
        nodes = soup.select(selector)
        if not nodes:
            continue
        text = " ".join(node.get_text(" ", strip=True) for node in nodes)
        text = " ".join(text.split())
        if len(text) >= min_chars:
            return text

    text = soup.get_text(" ", strip=True)
    return " ".join(text.split())


def _extract_links(base_url: str, soup: BeautifulSoup, domain: str) -> List[str]:
    links: List[str] = []
    for anchor in soup.find_all("a", href=True):
        absolute = _canonicalize_url(urljoin(base_url, anchor["href"]))
        if not absolute.startswith("http"):
            continue
        if _is_legal_page_candidate(absolute, domain):
            links.append(absolute)
    return links


def _fetch_page(session: requests.Session, url: str, timeout_seconds: int) -> Optional[str]:
    try:
        response = session.get(url, timeout=timeout_seconds)
        response.raise_for_status()
        return response.text
    except requests.RequestException:
        return None


def scrape_justice_site(output_path: Path, config: ScrapeConfig) -> int:
    session = requests.Session()
    session.headers.update(DEFAULT_HEADERS)

    start = _canonicalize_url(config.start_url)
    domain = urlparse(start).netloc

    queue: Deque[str] = deque([start])
    queued: Set[str] = {start}
    visited: Set[str] = set()

    saved_count = 0

    with output_path.open("w", encoding="utf-8") as handle:
        progress = tqdm(total=config.max_pages, desc="Scraping justice pages")

        while queue and len(visited) < config.max_pages:
            current = queue.popleft()
            if current in visited:
                continue

            visited.add(current)
            progress.update(1)

            html = _fetch_page(session, current, config.timeout_seconds)
            if html is None:
                time.sleep(config.delay_seconds)
                continue

            soup = BeautifulSoup(html, "lxml")
            body = _extract_body(soup, config.min_body_chars)

            if len(body) >= config.min_body_chars:
                item: Dict[str, str] = {
                    "id": hashlib.md5(current.encode("utf-8")).hexdigest(),
                    "url": current,
                    "title": _extract_title(soup),
                    "body": body,
                }
                handle.write(json.dumps(item, ensure_ascii=False) + "\n")
                saved_count += 1

            for link in _extract_links(current, soup, domain):
                if link in visited or link in queued:
                    continue
                queue.append(link)
                queued.add(link)

            time.sleep(config.delay_seconds)

        progress.close()

    return saved_count
