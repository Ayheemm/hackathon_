import requests
import numpy as np

class OllamaEmbedder:
    def __init__(self, model_name: str="nomic-embed-text-v2-moe"):
        self.model_name = model_name
        self.url = "http://localhost:11434/api/embed"

    def encode(self, texts, normalize_embeddings: bool = True):
        if isinstance(texts, str):
            texts = [texts]
        
        payload = {
            "model": self.model_name,
            "input": texts
        }
        res = requests.post(self.url, json=payload)
        res.raise_for_status()
        
        embeds = res.json().get("embeddings", [])
        arr = np.array(embeds, dtype=np.float32)
        
        if normalize_embeddings:
            norms = np.linalg.norm(arr, axis=1, keepdims=True)
            arr = arr / np.where(norms == 0, 1, norms)
            
        return arr
