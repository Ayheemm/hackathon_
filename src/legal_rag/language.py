import re

try:
    from langdetect import LangDetectException, detect as _detect
except ImportError:
    LangDetectException = Exception
    _detect = None

ARABIC_CHARS = re.compile(r"[\u0600-\u06FF]")


def arabic_ratio(text: str) -> float:
    if not text:
        return 0.0
    return len(ARABIC_CHARS.findall(text)) / len(text)


def detect_language(text: str) -> str:
    ratio = arabic_ratio(text)
    if ratio >= 0.25:
        return "ar"

    if _detect is None:
        return "fr"

    try:
        lang = _detect(text)
    except LangDetectException:
        return "fr"

    if lang == "ar":
        return "ar"
    return "fr"
