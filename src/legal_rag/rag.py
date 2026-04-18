from pathlib import Path
from typing import Dict, List, Optional

from .language import detect_language
from .llm import load_generator_if_available
from .retriever import FaissRetriever
from .settings import DEFAULT_EMBEDDING_MODEL


class LegalRagEngine:
    def __init__(
        self,
        index_path: Path,
        metadata_db_path: Path,
        embedding_model_name: str = DEFAULT_EMBEDDING_MODEL,
        model_ref: Optional[str] = None,
    ):
        self.retriever = FaissRetriever(
            index_path=index_path,
            metadata_db_path=metadata_db_path,
            embedding_model_name=embedding_model_name,
        )
        self.generator = load_generator_if_available(model_ref)

    @staticmethod
    def _build_prompt(query: str, lang: str, chunks: List[Dict[str, str]], plain: bool = False) -> str:
        if lang == "ar":
            if plain:
                instruction = (
                    "أنت مساعد قانوني مختص في القانون التونسي. "
                    "أجب بالعربية بناءً فقط على السياق القانوني المعطى. "
                    "إذا لم تكن الإجابة موجودة في السياق، فقل ذلك بوضوح. "
                    "استشهد دائمًا بالمصادر مع العنوان والرابط."
                )
            else:
                instruction = (
                    "You are a legal assistant for Tunisian law. "
                    "Answer in Arabic using only the provided legal context. "
                    "If the answer is not in context, explicitly say that. "
                    "Always cite sources by title and URL."
                )
        else:
            if plain:
                instruction = (
                    "Tu es un assistant juridique specialise en droit tunisien. "
                    "Reponds en francais uniquement avec le contexte fourni. "
                    "Si l'information est absente, dis-le explicitement. "
                    "Cite toujours les sources avec titre et URL."
                )
            else:
                instruction = (
                    "Tu es un assistant juridique specialise en droit tunisien. "
                    "Reponds en francais en te basant uniquement sur le contexte legal fourni. "
                    "Si l'information est absente, dis-le explicitement. "
                    "Cite toujours les sources avec titre et URL."
                )

        context = "\n\n---\n\n".join(
            f"[Source: {item['title']} | {item['url']}]\n{item['text']}" for item in chunks
        )

        if plain:
            return (
                f"{instruction}\n\n"
                f"Contexte legal:\n{context}\n\n"
                f"Question: {query}\n"
            )

        return (
            "<s>[INST] "
            f"{instruction}\n\n"
            f"Legal context:\n{context}\n\n"
            f"Question: {query} "
            "[/INST]"
        )

    @staticmethod
    def _format_citations(chunks: List[Dict[str, str]], lang: str) -> str:
        if not chunks:
            return ""

        unique = []
        seen = set()
        for item in chunks:
            key = (item["title"], item["url"])
            if key in seen:
                continue
            seen.add(key)
            unique.append(item)

        if lang == "ar":
            header = "\n\n**المصادر القانونية:**"
        else:
            header = "\n\n**Sources juridiques:**"

        lines = [f"- {item['title']} ({item['url']})" for item in unique]
        return header + "\n" + "\n".join(lines)

    @staticmethod
    def _fallback_answer(query: str, chunks: List[Dict[str, str]], lang: str) -> str:
        top = chunks[0]["text"]
        snippet = top[:700] + ("..." if len(top) > 700 else "")

        if lang == "ar":
            return (
                "لم يتم تحميل نموذج لغوي محلي بعد. "
                "إليك أقرب مقتطف قانوني مرتبط بسؤالك:\n\n"
                f"{snippet}"
            )

        return (
            "Aucun modele local n'est charge pour le moment. "
            "Voici l'extrait legal le plus pertinent pour votre question:\n\n"
            f"{snippet}"
        )

    def answer(self, query: str, k: int = 5, min_score: float = 0.35, max_tokens: int = 512, images: Optional[List[str]] = None) -> Dict[str, object]:
        lang = detect_language(query)
        chunks = self.retriever.retrieve(query=query, k=k, min_score=min_score)

        if not chunks:
            if lang == "ar":
                answer = "لم أجد نصوصا قانونية موثوقة مرتبطة بهذا السؤال."
            else:
                answer = "Je n'ai pas trouve de textes juridiques suffisamment pertinents pour cette question."
            return {"answer": answer, "sources": [], "language": lang}

        if self.generator is not None:
            prompt = self._build_prompt(
                query=query,
                lang=lang,
                chunks=chunks,
                plain=getattr(self.generator, "is_ollama", False),
            )
            try:
                # Only OllamaGenerator supports images in our new setup
                if images and hasattr(self.generator, "is_ollama"):
                    body = self.generator.generate(prompt=prompt, max_tokens=max_tokens, temperature=0.1, images=images)
                else:
                    body = self.generator.generate(prompt=prompt, max_tokens=max_tokens, temperature=0.1)
                error = None
            except Exception as exc:
                error = f"{exc.__class__.__name__}: {exc}"
                body = self._fallback_answer(query=query, chunks=chunks, lang=lang)
        else:
            body = self._fallback_answer(query=query, chunks=chunks, lang=lang)
            error = None

        citations = self._format_citations(chunks, lang)
        result = {
            "answer": body + citations,
            "sources": [{"title": item["title"], "url": item["url"]} for item in chunks],
            "language": lang,
            "error": error,
        }

        if error:
            print(f"[LegalRagEngine] generation error: {error}")

        return result

    def close(self) -> None:
        self.retriever.close()
