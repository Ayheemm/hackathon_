#!/usr/bin/env python3

from pathlib import Path

import torch
from peft import AutoPeftModelForCausalLM
from transformers import AutoTokenizer

ROOT = Path(__file__).parent
LORA_DIR = ROOT / "models" / "mizan-lora"
MERGED_DIR = ROOT / "models" / "mizan-merged"


def main() -> int:
    if not LORA_DIR.exists():
        print(f"LoRA adapter not found: {LORA_DIR}")
        return 1

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

    print(f"Merged model saved -> {MERGED_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
