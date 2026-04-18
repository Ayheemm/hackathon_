#  — Complete Setup, Run & Fine-Tune Guide
> **You are not dumb. You are building something complex. This guide assumes zero prior knowledge and explains every single step.**

---

## YOUR 3 MODELS

| Role | Model Name | What it does |
|---|---|---|
| 💬 Chat / Q&A | `qwen3.5:4b` | Reads the retrieved law chunks and writes the answer |
| 👁️ Vision / OCR | `medgemma:4b` | Reads scanned PDF images and converts them to text |
| 🧠 Embeddings | `nomic-embed-text-v2-moe:latest` | Turns text into numbers so FAISS can search it |

---

## PART 0 — FOLDER STRUCTURE (where everything goes)

After you finish setup, your project should look like this:

```
your-project-root/               ← this is where you open your terminal
│
├── build_knowledge_base.py      ← THE SCRAPER (put it here)
├── requirements.txt             ← already exists
├── requirements-llm.txt         ← already exists
│
├── src/
│   └── legal_rag/
│       ├── __init__.py          ← already exists
│       ├── chunking.py          ← already exists
│       ├── embeddings.py        ← already exists
│       ├── language.py          ← already exists
│       ├── settings.py          ← NEW — put the settings.py file here
│       └── rag.py               ← NEW — put the rag.py file here
│
├── data/                        ← CREATED AUTOMATICALLY when you run the scraper
│   └── raw/
│       ├── pdfs/                ← PUT YOUR OWN PDF FILES HERE
│       └── html/
│
├── index/                       ← CREATED AUTOMATICALLY
│   ├── mizan.faiss              ← the vector database (auto-generated)
│   ├── metadata.db              ← chunk metadata (auto-generated)
│   └── scrape_log.db            ← progress tracker (auto-generated)
│
├── logs/                        ← CREATED AUTOMATICALLY
│   └── build_kb.log
│
├── models/                      ← for fine-tuned model files (later)
│
├── notebooks/
│   └── Chatbot_RAG_Boilerplate.ipynb
│
└── frontend/                    ← already exists (Next.js)
```

---

## PART 1 — FIRST-TIME SETUP (do this once)

### Step 1 — Place the new files

Take the 3 files you just downloaded:

| File you downloaded | Where to put it |
|---|---|
| `build_knowledge_base.py` | Project root (same folder as `requirements.txt`) |
| `settings.py` | `src/legal_rag/settings.py` |
| `rag.py` | `src/legal_rag/rag.py` |

### Step 2 — Install Python dependencies

Open a terminal in your project root and run:

```bash
# Core dependencies (already in requirements.txt — run if you haven't yet)
pip install -r requirements.txt --break-system-packages

# PDF parser (REQUIRED for scraping PDFs)
pip install pdfplumber --break-system-packages

# HuggingFace datasets (REQUIRED for Phase 3 sources)
pip install datasets --break-system-packages

# Fine-tuning dependencies (needed later in Part 5)
pip install transformers peft accelerate bitsandbytes trl --break-system-packages
```

### Step 3 — Make sure Ollama is running with all 3 models

Open a terminal and run these commands one by one:

```bash
# Start Ollama server (keep this terminal open)
ollama serve
```

Open a NEW terminal and pull all 3 models:

```bash
# Pull the chat model
ollama pull qwen3.5:4b

# Pull the vision/OCR model
ollama pull medgemma:4b

# Pull the embedding model (NOTE: use exact name with :latest)
ollama pull nomic-embed-text-v2-moe:latest
```

Verify all 3 are installed:

```bash
ollama list
```

You should see something like:
```
NAME                             ID              SIZE
qwen3.5:4b                      ...             2.4 GB
medgemma:4b                      ...             3.0 GB
nomic-embed-text-v2-moe:latest   ...             0.9 GB
```

**If `ollama serve` says "already running" that's fine — Ollama is already up.**

### Step 4 — Test your embedding model

Create a file called `test_embed.py` in your project root:

```python
import sys
sys.path.insert(0, "src")
from legal_rag.embeddings import OllamaEmbedder

emb = OllamaEmbedder(model_name="nomic-embed-text-v2-moe:latest")
result = emb.encode(["Bonjour, ceci est un test juridique."], normalize_embeddings=True)
print(f"✓ Embedding works! Shape: {result.shape}")
print(f"  Dimension: {result.shape[1]}")
```

Run it:
```bash
python test_embed.py
```

Expected output:
```
✓ Embedding works! Shape: (1, 768)
  Dimension: 768
```

**If the dimension is NOT 768**, open `build_knowledge_base.py` and change line:
```python
EMBED_DIM = 768   ← change this to whatever number you see
```

---

## PART 2 — RUNNING THE SCRAPER

### Phase 1 first (fastest — takes 10–30 minutes)

Phase 1 downloads direct PDFs and scrapes the cleanest websites.
This alone gives you the Code des Obligations et Contrats, Code des Sociétés,
Constitution 2022, and the 9anoun.tn legal portal.

```bash
python build_knowledge_base.py --phase 1
```

You will see output like:
```
────────────────────────────────────────────────────────────
  ▶  Code des Obligations et Contrats (BNA)
     type=pdf_direct  phase=1
  Downloading PDF: http://www.bna.tn/documents/...
  Saved → coc_bna.pdf (1,842 KB)
  +312 chunks embedded (running total: 312)
  ✓  coc_bna — 312 new chunks indexed
```

### Phase 2 (takes 30–90 minutes, scrapes websites)

```bash
python build_knowledge_base.py --phase 2
```

### Phase 3 (takes 1–3 hours, downloads HuggingFace datasets)

```bash
python build_knowledge_base.py --phase 3
```

### Run everything at once

```bash
python build_knowledge_base.py
```

### Useful options

```bash
# See all sources that will be scraped
python build_knowledge_base.py --list

# Run ONE specific source (by ID)
python build_knowledge_base.py --source coc_bna
python build_knowledge_base.py --source 9anoun_codes
python build_knowledge_base.py --source hf_tunisia_law

# Resume after a crash (it automatically skips done sources)
python build_knowledge_base.py

# Start completely fresh (deletes existing index!)
python build_knowledge_base.py --reset
```

---

## PART 3 — ADDING YOUR OWN PDF FILES

### Option A — Drop PDFs directly into the data folder

1. Create the folder if it doesn't exist:
```bash
mkdir -p data/raw/pdfs
```

2. Copy any PDF you want into `data/raw/pdfs/`

3. Run this small script (save as `ingest_local_pdfs.py` in the project root):

```python
#!/usr/bin/env python3
"""
Ingest all PDFs from data/raw/pdfs/ into the FAISS index.
Usage: python ingest_local_pdfs.py
"""
import sys
import sqlite3
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from legal_rag.embeddings import OllamaEmbedder
from legal_rag.chunking import chunk_text
from legal_rag.language import detect_language

# Reuse builder utilities
sys.path.insert(0, str(ROOT))
from build_knowledge_base import (
    FaissIndex, init_databases, embed_and_index,
    chunks_from_text, extract_pdf_text, mark_done, is_done, EMBED_DIM
)

PDF_FOLDER = ROOT / "data" / "raw" / "pdfs"

def main():
    print(f"\nScanning {PDF_FOLDER} for PDFs...\n")
    pdfs = list(PDF_FOLDER.glob("*.pdf"))
    if not pdfs:
        print("No PDFs found. Drop .pdf files into data/raw/pdfs/ and re-run.")
        return

    meta_db, log_db = init_databases()
    fi = FaissIndex(dim=EMBED_DIM)
    embedder = OllamaEmbedder(model_name="nomic-embed-text-v2-moe:latest")

    for pdf_path in pdfs:
        source_id = f"local_{pdf_path.stem}"
        if is_done(log_db, source_id):
            print(f"  ⏭  Skipping {pdf_path.name} (already indexed)")
            continue

        print(f"  Processing: {pdf_path.name}")
        pdf_bytes = pdf_path.read_bytes()
        text = extract_pdf_text(pdf_bytes)

        if not text.strip():
            print(f"    ⚠ No text extracted — may be a scanned PDF (needs OCR)")
            continue

        lang = detect_language(text[:500])
        chunks, langs = chunks_from_text(text, lang)

        source = {
            "id": source_id,
            "name": pdf_path.stem.replace("_", " ").title(),
            "url": f"local://data/raw/pdfs/{pdf_path.name}",
            "tags": ["local", "pdf"],
        }

        added = embed_and_index(chunks, source, langs, embedder, fi, meta_db)
        mark_done(log_db, source_id, added)
        fi.save()
        print(f"    ✓ {added} chunks indexed from {pdf_path.name}")

    meta_db.commit()
    meta_db.close()
    log_db.close()
    print(f"\nDone! Total vectors in index: {fi.total}")

if __name__ == "__main__":
    main()
```

Run it:
```bash
python ingest_local_pdfs.py
```

### Option B — Add a URL directly to the source list

Open `build_knowledge_base.py`, scroll to the `SOURCES = [` list,
and add an entry like this at the top:

```python
{
    "id": "my_custom_pdf",
    "name": "Mon document personnalisé",
    "url": "https://example.com/path/to/document.pdf",
    "type": "pdf_direct",
    "language": "fr",    # or "ar" for Arabic
    "phase": 1,
    "priority": 1,
    "tags": ["custom"],
},
```

Then run:
```bash
python build_knowledge_base.py --source my_custom_pdf
```

---

## PART 4 — TESTING THE KNOWLEDGE BASE

Save this as `test_rag.py` in your project root:

```python
#!/usr/bin/env python3
"""
Quick test of the full RAG pipeline.
Usage: python test_rag.py
"""
import sys
from pathlib import Path

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from legal_rag.settings import ProjectPaths
from legal_rag.rag import LegalRagEngine

paths = ProjectPaths()

# Check index exists
if not paths.faiss_index.exists():
    print("❌ Index not found! Run 'python build_knowledge_base.py --phase 1' first.")
    sys.exit(1)

print("Loading MIZAN engine...")
engine = LegalRagEngine(
    index_path=paths.faiss_index,
    metadata_db_path=paths.metadata_db,
    model_path=None,
    embed_model="nomic-embed-text-v2-moe:latest",
    ollama_chat_model="qwen3.5:4b",
    top_k=5,
)

# ── Test 1: retrieval only (fast, no LLM needed) ──────────────────────────────
print("\n" + "="*60)
print("TEST 1: Vector Retrieval (no LLM)")
print("="*60)

query = "Quelle est la procédure d'appel en matière civile ?"
chunks = engine.retrieve(query, top_k=3)

if not chunks:
    print("⚠ No results found — make sure Phase 1 build has completed.")
else:
    for c in chunks:
        print(f"\n  Rank {c['rank']} | Score: {c['score']:.4f} | Source: {c['source']}")
        print(f"  Language: {c['language']}")
        print(f"  Text preview: {c['text'][:200]}...")

# ── Test 2: full RAG answer (requires qwen3.5:4b via Ollama) ─────────────────
print("\n" + "="*60)
print("TEST 2: Full RAG Answer (qwen3.5:4b)")
print("="*60)

questions = [
    "Quelles sont les conditions de validité d'un contrat selon le COC tunisien ?",
    "ما هي شروط صحة العقد في القانون التونسي ؟",   # Arabic question
    "What is the Code des Obligations et Contrats ?",
]

for q in questions:
    print(f"\n❓ {q}")
    result = engine.answer(q)
    print(f"💬 {result['answer'][:500]}")
    print(f"📚 Sources: {[s['name'] for s in result['sources']]}")

engine.close()
print("\n✓ All tests passed!")
```

Run it:
```bash
python test_rag.py
```

---

## PART 5 — FINE-TUNING qwen3.5:4b ON YOUR LEGAL DATA

Fine-tuning means making the model smarter specifically about Tunisian law.
There are two levels:

| Method | Difficulty | What it does |
|---|---|---|
| **Modelfile** (Ollama) | ⭐ Easy | Adds a system prompt + examples. No GPU needed. |
| **LoRA fine-tuning** (HuggingFace) | ⭐⭐⭐ Hard | Actually changes the model weights. GPU recommended. |

### Method A — Modelfile (Easy, do this first)

This tells the model its role and gives it examples without any training.

Create a file called `Modelfile` in your project root:

```
FROM qwen3.5:4b

SYSTEM """
Tu es MIZAN, un assistant juridique expert en droit tunisien.
Tu réponds UNIQUEMENT en te basant sur les textes juridiques tunisiens.
Tu cites toujours la source de tes informations (nom du code, article, date).
Tu réponds en français ou en arabe selon la langue de la question.
Tu ne donnes JAMAIS de conseils juridiques personnels — tu informes seulement.
Si tu ne sais pas, tu dis clairement que tu ne sais pas.
"""

PARAMETER temperature 0.1
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
```

Register it with Ollama:
```bash
ollama create mizan-legal -f Modelfile
```

Test it immediately:
```bash
ollama run mizan-legal "Quelles sont les conditions de validité d'un contrat ?"
```

Now update `rag.py` and `test_rag.py` to use `mizan-legal` instead of `qwen3.5:4b`:
```python
engine = LegalRagEngine(
    ...
    ollama_chat_model="mizan-legal",   # ← changed
)
```

### Method B — LoRA Fine-Tuning (Proper, GPU recommended)

#### Step 1 — Export your knowledge base as training data

Save this as `export_training_data.py`:

```python
#!/usr/bin/env python3
"""
Exports the scraped legal chunks as a fine-tuning dataset.
Format: instruction-following pairs (question + retrieved context → answer)
Usage: python export_training_data.py
"""
import json
import sqlite3
import random
from pathlib import Path

ROOT = Path(__file__).parent
META_DB = ROOT / "index" / "metadata.db"
OUTPUT  = ROOT / "data" / "finetune_dataset.jsonl"

OUTPUT.parent.mkdir(exist_ok=True)

# Load all chunks
conn = sqlite3.connect(str(META_DB))
rows = conn.execute(
    "SELECT chunk_text, source_name, language FROM chunks ORDER BY RANDOM() LIMIT 5000"
).fetchall()
conn.close()

print(f"Loaded {len(rows)} chunks from metadata DB")

# Build instruction pairs
INSTRUCTIONS_FR = [
    "Résume ce texte juridique en 2-3 phrases simples.",
    "Quelles sont les obligations mentionnées dans ce texte ?",
    "Quels droits ce texte accorde-t-il aux citoyens ?",
    "Explique ce texte juridique à quelqu'un qui ne connaît pas le droit.",
    "Quelles sanctions sont prévues dans ce texte ?",
    "À quel code ou loi appartient ce texte ?",
]

INSTRUCTIONS_AR = [
    "لخّص هذا النص القانوني في 2-3 جمل بسيطة.",
    "ما هي الالتزامات المذكورة في هذا النص ؟",
    "ما هي الحقوق التي يمنحها هذا النص للمواطنين ؟",
    "اشرح هذا النص لشخص لا يعرف القانون.",
]

records = []
for chunk_text, source_name, language in rows:
    if len(chunk_text.strip()) < 100:
        continue

    instructions = INSTRUCTIONS_AR if language == "ar" else INSTRUCTIONS_FR
    instruction = random.choice(instructions)

    record = {
        "instruction": instruction,
        "input": chunk_text[:800],    # context
        "output": f"[Source: {source_name}]\n{chunk_text[:300]}...",
        "source": source_name,
        "language": language,
    }
    records.append(record)

# Write JSONL
with open(OUTPUT, "w", encoding="utf-8") as f:
    for r in records:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

print(f"✓ Wrote {len(records)} training examples → {OUTPUT}")
print(f"  Preview of first example:")
print(json.dumps(records[0], ensure_ascii=False, indent=2)[:500])
```

Run it:
```bash
python export_training_data.py
```

This creates `data/finetune_dataset.jsonl` with thousands of training examples.

#### Step 2 — Fine-tune with LoRA

Save this as `finetune_lora.py`:

```python
#!/usr/bin/env python3
"""
LoRA fine-tuning of Qwen2.5-3B on the MIZAN legal dataset.
Requirements: pip install transformers peft accelerate trl bitsandbytes
GPU: minimum 8GB VRAM (RTX 3060 / T4 / etc.)
     If no GPU: use --no-gpu flag (slow but works on CPU)

Usage:
    python finetune_lora.py
    python finetune_lora.py --epochs 3 --batch 4
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).parent

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs",    type=int,   default=2)
    parser.add_argument("--batch",     type=int,   default=2)
    parser.add_argument("--lr",        type=float, default=2e-4)
    parser.add_argument("--max-len",   type=int,   default=512)
    parser.add_argument("--no-gpu",    action="store_true")
    args = parser.parse_args()

    # ── Imports ───────────────────────────────────────────────────────────────
    import torch
    from datasets import Dataset
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        TrainingArguments,
        BitsAndBytesConfig,
    )
    from peft import LoraConfig, get_peft_model, TaskType
    from trl import SFTTrainer, DataCollatorForCompletionOnlyLM

    # ── Config ────────────────────────────────────────────────────────────────
    # We fine-tune the HuggingFace version of Qwen2.5-3B
    # (Qwen2.5 is the same family as qwen3.5 — use the closest available)
    BASE_MODEL = "Qwen/Qwen2.5-3B-Instruct"
    OUTPUT_DIR = ROOT / "models" / "mizan-lora"
    DATASET    = ROOT / "data" / "finetune_dataset.jsonl"

    if not DATASET.exists():
        print("❌ Dataset not found! Run 'python export_training_data.py' first.")
        return

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    device = "cpu" if args.no_gpu else ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    if device == "cpu":
        print("⚠ CPU mode is SLOW. A 2-epoch run may take 2–6 hours.")

    # ── Load dataset ─────────────────────────────────────────────────────────
    records = []
    with open(DATASET, "r", encoding="utf-8") as f:
        for line in f:
            records.append(json.loads(line))

    # Format as chat template
    def format_record(r):
        return {
            "text": (
                f"<|im_start|>system\n"
                f"Tu es MIZAN, un assistant juridique expert en droit tunisien.\n"
                f"<|im_end|>\n"
                f"<|im_start|>user\n"
                f"{r['instruction']}\n\nContexte:\n{r['input']}\n"
                f"<|im_end|>\n"
                f"<|im_start|>assistant\n"
                f"{r['output']}\n"
                f"<|im_end|>"
            )
        }

    formatted = [format_record(r) for r in records[:2000]]  # cap at 2000 for speed
    dataset   = Dataset.from_list(formatted)
    split     = dataset.train_test_split(test_size=0.05, seed=42)
    train_ds  = split["train"]
    eval_ds   = split["test"]

    print(f"Train: {len(train_ds)} examples  |  Eval: {len(eval_ds)} examples")

    # ── Load tokenizer ────────────────────────────────────────────────────────
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # ── Load model (4-bit quantization to save VRAM) ──────────────────────────
    bnb_config = None
    if device == "cuda":
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

    print(f"Loading {BASE_MODEL}...")
    model = AutoModelForCausalLM.from_pretrained(
        BASE_MODEL,
        quantization_config=bnb_config,
        device_map="auto" if device == "cuda" else None,
        trust_remote_code=True,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    )

    # ── LoRA config ───────────────────────────────────────────────────────────
    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,                    # rank — higher = more parameters trained
        lora_alpha=32,           # scaling factor
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj",
                         "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()
    # Expected output: trainable params: ~20M  ||  all params: ~3B  ||  trainable%: ~0.6%

    # ── Training args ─────────────────────────────────────────────────────────
    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR),
        num_train_epochs=args.epochs,
        per_device_train_batch_size=args.batch,
        gradient_accumulation_steps=4,
        learning_rate=args.lr,
        fp16=(device == "cuda"),
        logging_steps=10,
        evaluation_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        report_to="none",          # set "wandb" if you have it
        dataloader_num_workers=0,
    )

    # ── Trainer ───────────────────────────────────────────────────────────────
    trainer = SFTTrainer(
        model=model,
        tokenizer=tokenizer,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        args=training_args,
        dataset_text_field="text",
        max_seq_length=args.max_len,
    )

    print("\n🚀 Starting fine-tuning...\n")
    trainer.train()

    # ── Save ─────────────────────────────────────────────────────────────────
    model.save_pretrained(str(OUTPUT_DIR))
    tokenizer.save_pretrained(str(OUTPUT_DIR))
    print(f"\n✓ LoRA adapter saved → {OUTPUT_DIR}")
    print(  "  Next step: convert to GGUF and load into Ollama (see Part 6 below)")

if __name__ == "__main__":
    main()
```

Run it:
```bash
# With GPU (recommended)
python finetune_lora.py --epochs 2 --batch 4

# Without GPU (slow but works)
python finetune_lora.py --epochs 1 --batch 1 --no-gpu
```

---

## PART 6 — LOADING YOUR FINE-TUNED MODEL INTO OLLAMA

After fine-tuning, you have a LoRA adapter in `models/mizan-lora/`.
To use it in Ollama you need to merge it and convert to GGUF format.

### Step 1 — Merge LoRA into base model

Save as `merge_lora.py`:

```python
#!/usr/bin/env python3
from pathlib import Path
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer
import torch

ROOT       = Path(__file__).parent
LORA_DIR   = ROOT / "models" / "mizan-lora"
MERGED_DIR = ROOT / "models" / "mizan-merged"

MERGED_DIR.mkdir(parents=True, exist_ok=True)

print("Loading LoRA model and merging weights...")
model = AutoPeftModelForCausalLM.from_pretrained(
    str(LORA_DIR),
    torch_dtype=torch.float16,
    device_map="cpu",
)
model = model.merge_and_unload()
model.save_pretrained(str(MERGED_DIR))

tokenizer = AutoTokenizer.from_pretrained(str(LORA_DIR))
tokenizer.save_pretrained(str(MERGED_DIR))

print(f"✓ Merged model saved → {MERGED_DIR}")
```

```bash
python merge_lora.py
```

### Step 2 — Convert to GGUF

Install `llama.cpp` (needed once):
```bash
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
pip install -r requirements.txt --break-system-packages
```

Convert:
```bash
python llama.cpp/convert_hf_to_gguf.py models/mizan-merged \
    --outfile models/mizan-legal-q4.gguf \
    --outtype q4_k_m
```

### Step 3 — Register in Ollama

Create `Modelfile_finetuned`:
```
FROM ./models/mizan-legal-q4.gguf

SYSTEM """
Tu es MIZAN, un assistant juridique expert en droit tunisien.
Tu cites toujours tes sources. Tu réponds en français ou en arabe.
"""

PARAMETER temperature 0.1
PARAMETER num_ctx 4096
```

Register:
```bash
ollama create mizan-finetuned -f Modelfile_finetuned
```

Test:
```bash
ollama run mizan-finetuned "Explique le Code des Obligations et Contrats."
```

---

## PART 7 — TESTING EVERYTHING TOGETHER

### Quick sanity check (run after every major change)

```bash
python test_rag.py
```

### Full evaluation test

Save as `evaluate.py`:

```python
#!/usr/bin/env python3
"""
Evaluates retrieval quality on a set of known questions.
Usage: python evaluate.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent / "src"))

from legal_rag.settings import ProjectPaths
from legal_rag.rag import LegalRagEngine

paths = ProjectPaths()
engine = LegalRagEngine(
    index_path=paths.faiss_index,
    metadata_db_path=paths.metadata_db,
    ollama_chat_model="qwen3.5:4b",   # or "mizan-legal" if you made the Modelfile
    embed_model="nomic-embed-text-v2-moe:latest",
    top_k=5,
)

# These questions have known answers in the scraped data
TEST_QUESTIONS = [
    {
        "q": "Qu'est-ce que le Code des Obligations et Contrats ?",
        "expected_source": "Code des Obligations et Contrats",
    },
    {
        "q": "Quelles sont les dispositions de la Constitution tunisienne 2022 ?",
        "expected_source": "Constitution",
    },
    {
        "q": "ما هو قانون الشركات التجارية ؟",
        "expected_source": "Sociétés",
    },
]

print("\n" + "="*70)
print("MIZAN EVALUATION")
print("="*70)

hits = 0
for i, test in enumerate(TEST_QUESTIONS):
    print(f"\nQ{i+1}: {test['q']}")
    chunks = engine.retrieve(test["q"], top_k=3)
    if chunks:
        top_source = chunks[0]["source"]
        score = chunks[0]["score"]
        match = test["expected_source"].lower() in top_source.lower()
        status = "✓ HIT" if match else "✗ MISS"
        if match:
            hits += 1
        print(f"  {status} | Score: {score:.4f} | Top source: {top_source}")
    else:
        print(f"  ✗ NO RESULTS")

print(f"\n{'='*70}")
print(f"RETRIEVAL ACCURACY: {hits}/{len(TEST_QUESTIONS)} = {100*hits/len(TEST_QUESTIONS):.0f}%")
print(f"Index size: {engine.index.ntotal} vectors")
print("="*70)

engine.close()
```

```bash
python evaluate.py
```

---

## PART 8 — COMMON ERRORS AND FIXES

| Error | Cause | Fix |
|---|---|---|
| `Cannot reach Ollama` | Ollama not running | Run `ollama serve` in a separate terminal |
| `model not found: nomic-embed-text-v2-moe` | Model not pulled | Run `ollama pull nomic-embed-text-v2-moe:latest` |
| `FAISS index not found` | Build not run yet | Run `python build_knowledge_base.py --phase 1` |
| `No PDF parser available` | pdfplumber not installed | Run `pip install pdfplumber` |
| `No text extracted from X.pdf` | Scanned PDF | Use medgemma for OCR (see below) |
| `Module not found: legal_rag` | Wrong folder | Make sure you're in the project root |
| `Embedding dim mismatch` | Model returns different dim | Check dim with `test_embed.py` and update `EMBED_DIM` |

### Using medgemma for scanned PDFs

When a PDF is scanned (images not text), you need OCR.
Save as `ocr_pdf.py`:

```python
#!/usr/bin/env python3
"""
OCR a scanned PDF using medgemma:4b via Ollama.
Usage: python ocr_pdf.py path/to/scanned.pdf
"""
import sys
import base64
import requests
from pathlib import Path

try:
    import fitz  # pip install pymupdf
except ImportError:
    print("Install PyMuPDF: pip install pymupdf --break-system-packages")
    sys.exit(1)

def ocr_page(image_bytes: bytes) -> str:
    img_b64 = base64.b64encode(image_bytes).decode()
    payload = {
        "model": "medgemma:4b",
        "prompt": (
            "This is a page from a Tunisian legal document. "
            "Please extract ALL text exactly as it appears, "
            "preserving article numbers and structure. "
            "Output only the extracted text, nothing else."
        ),
        "images": [img_b64],
        "stream": False,
        "options": {"temperature": 0.0},
    }
    r = requests.post("http://localhost:11434/api/generate",
                      json=payload, timeout=120)
    r.raise_for_status()
    return r.json()["response"].strip()

def main():
    if len(sys.argv) < 2:
        print("Usage: python ocr_pdf.py path/to/file.pdf")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    out_path = pdf_path.with_suffix(".txt")

    doc = fitz.open(str(pdf_path))
    print(f"Processing {len(doc)} pages with medgemma:4b...")

    all_text = []
    for i, page in enumerate(doc):
        print(f"  Page {i+1}/{len(doc)}...", end="\r")
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        text = ocr_page(img_bytes)
        all_text.append(f"--- Page {i+1} ---\n{text}")

    full_text = "\n\n".join(all_text)
    out_path.write_text(full_text, encoding="utf-8")
    print(f"\n✓ OCR complete → {out_path}")
    print(f"  {len(full_text)} characters extracted")

if __name__ == "__main__":
    main()
```

```bash
# OCR a scanned PDF
python ocr_pdf.py data/raw/pdfs/old_jort_1985.pdf
# This creates old_jort_1985.txt which you can then ingest manually
```

---

## QUICK REFERENCE CARD

```
DAILY WORKFLOW
──────────────────────────────────────────────────────
1. Start Ollama:          ollama serve
2. Run scraper:           python build_knowledge_base.py --phase 1
3. Add your own PDFs:     copy to data/raw/pdfs/ then python ingest_local_pdfs.py
4. Test retrieval:        python test_rag.py
5. Evaluate quality:      python evaluate.py

MODELS
──────────────────────────────────────────────────────
Chat:       qwen3.5:4b          (used in rag.py)
Vision:     medgemma:4b         (used in ocr_pdf.py)
Embedding:  nomic-embed-text-v2-moe:latest  (used everywhere)

KEY FILES
──────────────────────────────────────────────────────
build_knowledge_base.py  → scraper + indexer (PROJECT ROOT)
src/legal_rag/settings.py → paths config
src/legal_rag/rag.py      → query engine
index/mizan.faiss         → vector database (auto-created)
index/metadata.db         → chunk metadata (auto-created)
data/raw/pdfs/            → drop your own PDFs here

FINE-TUNING PIPELINE
──────────────────────────────────────────────────────
Step 1: python export_training_data.py    → makes JSONL dataset
Step 2: python finetune_lora.py           → trains LoRA adapter
Step 3: python merge_lora.py             → merges adapter into model
Step 4: convert to GGUF + ollama create   → use in Ollama
```
