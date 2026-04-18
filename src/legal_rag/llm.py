from pathlib import Path
from typing import Optional


class LlamaCppGenerator:
    def __init__(self, model_path: Path, n_ctx: int = 4096, n_threads: int = 4, n_gpu_layers: int = 0):
        if not model_path.exists():
            raise FileNotFoundError(f"Missing GGUF model: {model_path}")

        try:
            from llama_cpp import Llama
        except ImportError as exc:
            raise ImportError(
                "llama-cpp-python is not installed. Install it from requirements.txt."
            ) from exc

        self._llm = Llama(
            model_path=str(model_path),
            n_ctx=n_ctx,
            n_threads=n_threads,
            n_gpu_layers=n_gpu_layers,
            verbose=False,
        )

    def generate(self, prompt: str, max_tokens: int = 512, temperature: float = 0.1) -> str:
        response = self._llm(
            prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            stop=["</s>", "[INST]"],
        )
        return response["choices"][0]["text"].strip()


def load_generator_if_available(model_path: Optional[Path]) -> Optional[LlamaCppGenerator]:
    if model_path is None:
        return None
    if not model_path.exists():
        return None
    return LlamaCppGenerator(model_path=model_path)
