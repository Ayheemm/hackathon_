"""Bilingual Tunisian legal RAG package."""

__all__ = ["LegalRagEngine"]


def __getattr__(name: str):
	if name == "LegalRagEngine":
		from .rag import LegalRagEngine

		return LegalRagEngine
	raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
