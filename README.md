# Bilingual Legal Chatbot (Arabic + French) for Tunisian Law

This repository now contains a full local-first implementation of a bilingual legal chatbot with Retrieval Augmented Generation (RAG), aligned with your hackathon plan and tuned for laptop constraints.

## Deep Analysis of the Original Plan

The attached roadmap was strong and practical. Its key strengths were:

- Correct pipeline order: scrape -> clean -> chunk -> embed -> index -> retrieve -> generate.
- Good model choice for embeddings: multilingual MiniLM is lightweight and cross-lingual.
- Correct retrieval math: normalized embeddings + FAISS inner product for cosine similarity.
- Hallucination control strategy: prompt constraints + low temperature + relevance threshold.

To make it more hackathon-reliable in practice, this implementation adds:

- A modular codebase instead of notebook-only logic, so each stage can be run and debugged independently.
- A fallback answer mode when no GGUF LLM is loaded, so the demo still works with source-grounded snippets.
- Reusable CLI scripts for fast reruns (`run_pipeline.py`, `query_cli.py`) and a standalone UI entrypoint (`app.py`).
- Deterministic artifact paths for raw data, cleaned data, FAISS index, and SQLite metadata.

## What Is Implemented

- Scraping module for `https://www.justice.gov.tn/index.php?id=223` and related pages.
- Arabic/French cleaning and language detection.
- Chunking strategy with overlap.
- Multilingual embedding generation.
- FAISS index + SQLite metadata creation.
- Retrieval engine with score filtering.
- RAG response engine with citation formatting.
- Gradio local chat demo.
- Notebook integration snippets for your `Chatbot_RAG_Boilerplate.ipynb`.

## Project Structure

```text
.
|-- app.py
|-- requirements-llm.txt
|-- requirements.txt
|-- scripts/
|   |-- run_pipeline.py
|   `-- query_cli.py
|-- src/legal_rag/
|   |-- __init__.py
|   |-- chunking.py
|   |-- cleaning.py
|   |-- indexer.py
|   |-- language.py
|   |-- llm.py
|   |-- rag.py
|   |-- retriever.py
|   |-- scraper.py
|   `-- settings.py
`-- notebooks/
	`-- NOTEBOOK_INTEGRATION.md
```

## Local Setup (Windows PowerShell)

```powershell
py -3.11 -m venv .venv311
.\.venv311\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

Optional local generation dependency:

```powershell
pip install -r requirements-llm.txt
```

Note: `llama-cpp-python` may require Visual Studio Build Tools on Windows if no prebuilt wheel is available. The project still runs in retrieval fallback mode without it.

## Run the Data Pipeline

```powershell
python scripts/run_pipeline.py --max-pages 120 --delay 1.5
```

Generated artifacts:

- `data/raw/legal_raw.jsonl`
- `data/processed/legal_clean.jsonl`
- `data/processed/legal_index.faiss`
- `data/processed/legal_metadata.db`

## Optional: Download a Local GGUF Model

Recommended:

- `TheBloke/Mistral-7B-Instruct-v0.2-GGUF`
- file: `mistral-7b-instruct-v0.2.Q4_K_M.gguf`

Place model under `models/`.

## Quick Terminal Query

Without LLM (fallback snippet mode):

```powershell
python scripts/query_cli.py "Quelle est la procedure d'appel en matiere civile ?"
```

With local GGUF model:

```powershell
python scripts/query_cli.py "ما هي إجراءات الاستئناف في القضايا المدنية؟" --model-path models\mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

## Launch Gradio Demo

Without model (fallback mode):

```powershell
python app.py
```

With model:

```powershell
python app.py --model-path models\mistral-7b-instruct-v0.2.Q4_K_M.gguf
```

Open:

- `http://127.0.0.1:7860`

## Reliability and Anti-Hallucination Controls

- Retrieval score threshold (`--min-score`, default `0.35`).
- Source-constrained prompt instructions.
- Citation block appended to each answer.
- Low-temperature generation (`0.1`) when GGUF model is loaded.
- Explicit no-context response when confidence is low.

## Notebook Integration

Use snippets in:

- `notebooks/NOTEBOOK_INTEGRATION.md`

These cells let you call the same engine from your existing `Chatbot_RAG_Boilerplate.ipynb`.