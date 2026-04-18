from typing import List


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 80, min_chars: int = 80) -> List[str]:
    if chunk_size <= overlap:
        raise ValueError("chunk_size must be greater than overlap")

    words = text.split()
    chunks: List[str] = []
    step = chunk_size - overlap

    for start in range(0, len(words), step):
        window = words[start : start + chunk_size]
        if not window:
            continue
        chunk = " ".join(window).strip()
        if len(chunk) >= min_chars:
            chunks.append(chunk)

    return chunks
