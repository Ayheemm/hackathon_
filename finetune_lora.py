#!/usr/bin/env python3
"""
LoRA fine-tuning of Qwen2.5-3B on the MIZAN legal dataset.
Requirements: transformers peft accelerate trl bitsandbytes
"""

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).parent


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=2)
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--max-len", type=int, default=512)
    parser.add_argument("--no-gpu", action="store_true")
    args = parser.parse_args()

    import torch
    from datasets import Dataset
    from peft import LoraConfig, TaskType, get_peft_model
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from trl import SFTTrainer

    base_model = "Qwen/Qwen2.5-3B-Instruct"
    output_dir = ROOT / "models" / "mizan-lora"
    dataset_path = ROOT / "data" / "finetune_dataset.jsonl"

    if not dataset_path.exists():
        print("Dataset not found. Run: python export_training_data.py")
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)

    device = "cpu" if args.no_gpu else ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    records = []
    with open(dataset_path, "r", encoding="utf-8") as file:
        for line in file:
            records.append(json.loads(line))

    def format_record(record: dict) -> dict:
        return {
            "text": (
                "<|im_start|>system\n"
                "Tu es MIZAN, un assistant juridique expert en droit tunisien.\n"
                "<|im_end|>\n"
                "<|im_start|>user\n"
                f"{record['instruction']}\n\nContexte:\n{record['input']}\n"
                "<|im_end|>\n"
                "<|im_start|>assistant\n"
                f"{record['output']}\n"
                "<|im_end|>"
            )
        }

    formatted = [format_record(record) for record in records[:2000]]
    dataset = Dataset.from_list(formatted)
    split = dataset.train_test_split(test_size=0.05, seed=42)
    train_ds = split["train"]
    eval_ds = split["test"]

    print(f"Train: {len(train_ds)} | Eval: {len(eval_ds)}")

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    bnb_config = None
    if device == "cuda":
        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16,
            bnb_4bit_use_double_quant=True,
        )

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=bnb_config,
        device_map="auto" if device == "cuda" else None,
        trust_remote_code=True,
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    )

    lora_config = LoraConfig(
        task_type=TaskType.CAUSAL_LM,
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=0.05,
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    training_args = TrainingArguments(
        output_dir=str(output_dir),
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
        report_to="none",
        dataloader_num_workers=0,
    )

    trainer = SFTTrainer(
        model=model,
        processing_class=tokenizer,
        train_dataset=train_ds,
        eval_dataset=eval_ds,
        args=training_args,
        formatting_func=lambda row: row["text"],
    )

    print("Starting fine-tuning...")
    trainer.train()

    model.save_pretrained(str(output_dir))
    tokenizer.save_pretrained(str(output_dir))
    print(f"LoRA adapter saved -> {output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
