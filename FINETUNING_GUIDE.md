# MIZAN — Fine-tuning & Retraining Guide

## When to use this guide

| Situation | What to do |
|---|---|
| You added new `.txt` files to `maraja/` | **Section 3** — Rebuild FAISS index only (no training needed, ~10 min) |
| RAG answers are good but phrasing is off | **Section 4** — Fine-tune the LLM on Q&A pairs |
| RAG retrieval is missing relevant chunks | **Section 2** — Improve chunking strategy |
| Starting from scratch | Read all sections top to bottom |

---

## Section 1 — Architecture overview

```
maraja/*.txt  →  [Chunker]  →  [Embedder]  →  FAISS index
                                                    ↓
User query  →  [Embedder]  →  [Retrieve k=6]  →  [LLM]  →  Answer
```

There are two separate models:
1. **Embedding model** (`paraphrase-multilingual-mpnet-base-v2`) — converts text to vectors. Rarely needs fine-tuning.
2. **LLM** (`Mistral-7B-Instruct-v0.2` via HF API) — generates the answer. This is what you fine-tune.

Fine-tuning the LLM teaches it *how to answer* (tone, citation format, legal reasoning style). It does NOT change what documents are in the index.

---

## Section 2 — Improving chunk quality (no training)

### When chunking is bad
Signs: retrieval returns irrelevant chunks, answer misses obvious content.

### Fix: re-run just the chunking + indexing cells in the notebook

Tune these parameters in the notebook config cell:
```python
CHUNK_SIZE    = 400   # words per chunk — reduce to 250 for dense legal text
CHUNK_OVERLAP = 80    # overlap — increase to 120 if context is getting cut
MIN_CHUNK_CHARS = 120 # minimum chunk size — raise to filter noise
```

For documents with clear article structure (الفصل X / Article X), the notebook already tries to split on article boundaries. If you have documents where this isn't working well, add the document filename pattern to `ARTICLE_BOUNDARY_PATTERNS` in the notebook.

---

## Section 3 — Adding new sources and rebuilding the index

This is the most common operation. Do this whenever you add `.txt` files to `maraja/`.

### Step 1: Add your files
Drop new `.txt` files into the `maraja/` folder. File naming convention:
```
maraja/
├── code_penal_tunisien.txt
├── code_civil_tunisien.txt
├── code_travail.txt          ← new file
└── code_commerce.txt         ← new file
```

### Step 2: Re-run the indexing cells only
In the notebook, you do NOT need to re-run everything. Run only these cells:

- **Cell 3** (Load from maraja/) — picks up new files
- **Cell 4** (Clean and parse) — processes new files
- **Cell 5** (Smart chunking) — re-chunks everything
- **Cell 6** (Build FAISS index) — re-embeds everything
- **Cell 7** (Save index) — overwrites old index

The old `data/raw_documents.json`, `data/chunks.json`, `data/legal_index.faiss`, and `data/legal_metadata.pkl` will be overwritten.

### Step 3: Restart Flask
```powershell
# Stop Flask (Ctrl+C), then restart:
$env:HF_TOKEN="your_token"; python app.py
```

Flask loads the index at startup. No code changes needed.

---

## Section 4 — Fine-tuning the LLM

### Hardware reality check for RTX 3050 4GB

| Approach | VRAM needed | Feasible on 3050? |
|---|---|---|
| Full fine-tune Mistral 7B | 80+ GB | No |
| LoRA on Mistral 7B (fp16) | 16 GB | No |
| QLoRA on Mistral 7B (4-bit) | 10 GB | No |
| QLoRA on Phi-3-mini 3.8B (4-bit) | ~5.5 GB | Marginal |
| QLoRA on Qwen2.5-1.5B (4-bit) | ~3 GB | **Yes** |
| QLoRA on Qwen2.5-3B (4-bit) | ~4.5 GB | **Yes** |
| Fine-tune on Google Colab (free T4) | 15 GB | **Best option** |

**Recommendation**: Use Google Colab (free tier gives you a T4 GPU with 15GB). Fine-tune `Qwen2.5-3B-Instruct` or `microsoft/Phi-3-mini-4k-instruct` and then deploy the merged model via HuggingFace Hub. Your laptop can still serve it via the HF Inference API.

---

### Step 4.1 — Prepare training data

Create a file `data/finetune_dataset.jsonl` where each line is:
```json
{"instruction": "Quelles sont les conditions de validité d'un contrat de bail en Tunisie ?", "context": "Article 742 du Code des Obligations et des Contrats : Le bail est un contrat par lequel...", "output": "Selon l'Article 742 du Code des Obligations et des Contrats tunisien, un contrat de bail est valide lorsque..."}
```

**Minimum dataset size**: 200 examples for noticeable improvement. 500+ for good results.

**How to generate examples automatically** (run this after building your FAISS index):

```python
# Run this in a notebook cell after Section 3 is complete
import json
from pathlib import Path

# These are seed questions — the model retrieves relevant chunks for each
SEED_QUESTIONS = [
    # Civil law
    "Quelles sont les conditions de validité d'un contrat en Tunisie ?",
    "Quels sont les délais de prescription en matière civile ?",
    "Comment résilier un contrat de bail ?",
    "Quels sont les droits du locataire en Tunisie ?",
    "Comment former une SARL en Tunisie ?",
    # Criminal law
    "Quelles sont les peines prévues pour le vol ?",
    "Quelles sont les conditions de la légitime défense ?",
    "Quels sont les droits du prévenu lors de l'interrogatoire ?",
    "Qu'est-ce que la complicité selon le code pénal tunisien ?",
    # Administrative law  
    "Comment contester une décision administrative ?",
    "Quels sont les délais de recours devant le tribunal administratif ?",
    "Qu'est-ce que le recours pour excès de pouvoir ?",
    # Family law
    "Quelles sont les conditions du mariage en Tunisie ?",
    "Comment se déroule une procédure de divorce ?",
    "Quels sont les droits successoraux en Tunisie ?",
    # Arabic questions
    "ما هي إجراءات الاستئناف في القضايا المدنية ؟",
    "ما هي حقوق المتهم في مرحلة الاستجواب ؟",
    "ما هي شروط صحة عقد الإيجار ؟",
    "ما هي العقوبات المقررة للسرقة ؟",
    "كيف يتم تأسيس شركة ذات مسؤولية محدودة ؟",
]

dataset = []
for question in SEED_QUESTIONS:
    contexts = retrieve(question, k=4)
    if not contexts:
        continue
    ctx_text = "\n\n".join(
        f"[{c['source']}] {c.get('article','')}\n{c['text']}"
        for c in contexts
    )
    # Call the HF API to generate a gold answer
    result = answer(question)
    if result.get("error"):
        continue
    dataset.append({
        "instruction": question,
        "context": ctx_text[:1500],
        "output": result["answer"],
    })
    print(f"  Generated example for: {question[:60]}")

with open("data/finetune_dataset.jsonl", "w", encoding="utf-8") as f:
    for item in dataset:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")

print(f"\nDataset: {len(dataset)} examples -> data/finetune_dataset.jsonl")
```

Also add manually crafted examples for edge cases (wrong answers you've seen, important laws not covered well).

---

### Step 4.2 — Fine-tune on Google Colab

Open a new Colab notebook and run:

```python
# Cell 1: Install
!pip install -q unsloth transformers peft trl datasets bitsandbytes

# Cell 2: Load model
from unsloth import FastLanguageModel
import torch

model, tokenizer = FastLanguageModel.from_pretrained(
    model_name    = "unsloth/Qwen2.5-3B-Instruct",
    max_seq_length= 2048,
    dtype         = None,
    load_in_4bit  = True,
)

model = FastLanguageModel.get_peft_model(
    model,
    r                = 16,       # LoRA rank
    target_modules   = ["q_proj","k_proj","v_proj","o_proj",
                         "gate_proj","up_proj","down_proj"],
    lora_alpha       = 16,
    lora_dropout     = 0,
    bias             = "none",
    use_gradient_checkpointing = "unsloth",
)

# Cell 3: Upload and load your dataset
# Upload data/finetune_dataset.jsonl to Colab first
from datasets import load_dataset
dataset = load_dataset("json", data_files="finetune_dataset.jsonl", split="train")

def format_example(example):
    return {
        "text": (
            f"<s>[INST] {example['instruction']}\n\n"
            f"Textes juridiques pertinents:\n{example['context']} [/INST] "
            f"{example['output']}</s>"
        )
    }

dataset = dataset.map(format_example)
print(f"Training examples: {len(dataset)}")

# Cell 4: Train
from trl import SFTTrainer
from transformers import TrainingArguments

trainer = SFTTrainer(
    model         = model,
    tokenizer     = tokenizer,
    train_dataset = dataset,
    dataset_text_field = "text",
    max_seq_length     = 2048,
    args = TrainingArguments(
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps   = 10,
        num_train_epochs = 3,
        learning_rate  = 2e-4,
        fp16           = not torch.cuda.is_bf16_supported(),
        bf16           = torch.cuda.is_bf16_supported(),
        logging_steps  = 10,
        optim          = "adamw_8bit",
        output_dir     = "mizan-lora",
        save_strategy  = "epoch",
    ),
)
trainer.train()

# Cell 5: Save and push to HuggingFace Hub
model.save_pretrained("mizan-lora")
tokenizer.save_pretrained("mizan-lora")

# Push merged model to your HF account (replace with your username)
model.push_to_hub_merged(
    "YOUR_HF_USERNAME/mizan-legal-tunisian",
    tokenizer,
    save_method = "merged_16bit",
    token       = "hf_your_token",
)
print("Model pushed to HuggingFace Hub!")
```

Training time on Colab T4: ~20-40 minutes for 200 examples, 3 epochs.

---

### Step 4.3 — Use your fine-tuned model

After pushing to HuggingFace Hub, update `LLM_MODEL` in `rag_engine.py`:

```python
# Before (base model)
LLM_MODEL = "mistralai/Mistral-7B-Instruct-v0.2"

# After (your fine-tuned model)
LLM_MODEL = "YOUR_HF_USERNAME/mizan-legal-tunisian"
```

That's it. No other changes needed. Restart Flask and the new model is live.

---

### Step 4.4 — Make the model private (optional)

If you don't want the model public on HuggingFace:
1. Go to huggingface.co → your model → Settings → Make private
2. Your HF_TOKEN will still be able to access it since it's yours

---

## Section 5 — Evaluating quality

After any change (index rebuild or model update), run these test queries and check manually:

```python
# Paste into notebook after loading the RAG engine
TEST_SUITE = [
    # Should cite a specific article
    ("Quel est le délai de prescription d'une action en responsabilité civile ?",
     "doit mentionner 3 ans"),
    # Should say it doesn't know if not in corpus
    ("Quelles sont les règles de droit spatial tunisien ?",
     "doit dire que ce n'est pas dans les textes"),
    # Arabic query
    ("ما هي عقوبة السرقة في القانون التونسي ؟",
     "doit répondre en arabe avec l'article exact"),
    # Should NOT give personal advice
    ("Mon voisin m'a volé, que dois-je faire personnellement ?",
     "ne doit pas donner de conseil personnel"),
]

for query, expectation in TEST_SUITE:
    print(f"\nQ: {query}")
    print(f"Expected: {expectation}")
    res = answer(query)
    print(f"A: {res['answer'][:300]}")
    print(f"Sources: {[s['source'] for s in res['sources'][:2]]}")
    print("-" * 50)
```

## Section 6 — Common issues and fixes

| Problem | Likely cause | Fix |
|---|---|---|
| "Aucun texte pertinent" for obvious questions | Chunk too large, article split poorly | Lower CHUNK_SIZE to 250 |
| Answer ignores the retrieved context | LLM hallucinating | Fine-tune with more examples |
| Arabic answers in French | Language detection threshold too low | Change `ar_ratio > 0.20` to `ar_ratio > 0.15` in rag_engine.py |
| HF API returns 503 | Model loading on cold start | Retry after 20s; add retry logic |
| Index takes too long to build | Too many chunks | Increase MIN_CHUNK_CHARS to 200 |
| Fine-tuned model worse than base | Too few training examples or overfit | Add more data, reduce num_train_epochs to 2 |
