import sys

sys.path.insert(0, "src")

from legal_rag.embeddings import OllamaEmbedder


def main() -> None:
    emb = OllamaEmbedder(model_name="nomic-embed-text-v2-moe:latest")
    result = emb.encode(["Bonjour, ceci est un test juridique."], normalize_embeddings=True)
    print(f"Embedding works! Shape: {result.shape}")
    print(f"Dimension: {result.shape[1]}")


if __name__ == "__main__":
    main()
