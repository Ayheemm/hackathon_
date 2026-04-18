import requests
import numpy as np
import time

class OllamaEmbedder:
    def __init__(self, model_name: str="nomic-embed-text-v2-moe:latest"):
        self.model_name = model_name
        self.url = "http://localhost:11434/api/embed"

    def encode(self, texts, normalize_embeddings: bool = True):
        if isinstance(texts, str):
            texts = [texts]

        payload = {
            "model": self.model_name,
            "input": texts
        }

        last_error = None
        for attempt in range(3):
            try:
                res = requests.post(self.url, json=payload, timeout=120)
                res.raise_for_status()
                embeds = res.json().get("embeddings", [])
                if not embeds:
                    raise RuntimeError("Ollama returned no embeddings.")
                arr = np.atleast_2d(np.array(embeds, dtype=np.float32))
                break
            except (requests.RequestException, RuntimeError) as exc:
                last_error = exc
                if attempt < 2:
                    time.sleep(1.2 * (attempt + 1))
                    continue
                raise RuntimeError(f"Embedding request failed: {exc}") from exc

        if last_error is not None and 'arr' not in locals():
            raise RuntimeError(f"Embedding request failed: {last_error}")
        
        if normalize_embeddings:
            norms = np.linalg.norm(arr, axis=1, keepdims=True)
            arr = arr / np.where(norms == 0, 1, norms)
            
        return arr
