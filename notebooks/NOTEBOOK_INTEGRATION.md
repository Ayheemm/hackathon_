# Notebook Integration Snippets

Use these snippets in `Chatbot_RAG_Boilerplate.ipynb`.

## 1) Initialize Engine

```python
import sys
from pathlib import Path

ROOT = Path.cwd()
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from legal_rag.rag import LegalRagEngine
from legal_rag.settings import ProjectPaths

paths = ProjectPaths()
engine = LegalRagEngine(
    index_path=paths.faiss_index,
    metadata_db_path=paths.metadata_db,
    model_path=None,  # Set Path("models/your-model.gguf") when available
)
```

## 2) Ask a Question

```python
query = "Quelle est la procedure d'appel en matiere civile ?"
result = engine.answer(query)
print(result["answer"])
```

## 3) Optional Arabic Question

```python
query = "ما هي إجراءات الاستئناف في القضايا المدنية؟"
result = engine.answer(query)
print(result["answer"])
```
