import json
import logging
import random
import sys
from pathlib import Path
from datasets import load_dataset
from generate_training_data import (
    LABELS,
    MANIPULATIVE_TURNS,
    _build_context_input,
    _get_neutral_prev_turn,
    _synonym_swap
)

logger = logging.getLogger(__name__)

def generate_hf_dataset(
    output_path: str = "training_data_hf.jsonl",
    target_clean: int = 10_000,
    target_manipulative: int = 10_000,
    seed: int = 42
) -> None:
    rng = random.Random(seed)
    
    logger.info("Loading bitext/Bitext-customer-support-llm-chatbot-training-dataset from HuggingFace...")
    # Load dataset
    hf_dataset = load_dataset("bitext/Bitext-customer-support-llm-chatbot-training-dataset", split="train")
    
    logger.info(f"Loaded {len(hf_dataset)} rows. Sampling...")
    
    # Shuffle and select a subset
    sampled_indices = rng.sample(range(len(hf_dataset)), min(len(hf_dataset), max(target_clean, target_manipulative) * 3))
    
    samples = []
    
    # ── Collect all manipulative templates ──
    all_manip = []
    for pattern, turns in MANIPULATIVE_TURNS.items():
        all_manip.extend(turns)
    
    # ── Generate CLEAN samples using HF data ──
    logger.info("Generating CLEAN samples from HF data...")
    clean_count = 0
    clean_labels = [0] * len(LABELS)
    
    for idx in sampled_indices:
        if clean_count >= target_clean:
            break
            
        row = hf_dataset[idx]
        user_turn = row["instruction"]
        ai_current = row["response"]
        
        # We use a neutral previous turn (general_qa or sales)
        prev_ai = _get_neutral_prev_turn("general_qa", rng)
        
        text = _build_context_input(user_turn, prev_ai, ai_current)
        samples.append({"text": text, "labels": clean_labels})
        clean_count += 1
        
    # ── Generate MANIPULATIVE samples by augmenting HF data ──
    logger.info("Generating MANIPULATIVE samples using HF context + custom templates...")
    manip_count = 0
    
    # Keep adding manipulative samples until we hit target
    while manip_count < target_manipulative:
        idx = rng.choice(sampled_indices)
        row = hf_dataset[idx]
        user_turn = row["instruction"]
        
        # Pick a random manipulative turn
        turn_dict = rng.choice(all_manip)
        domain = turn_dict["domain"]
        
        prev_ai = _get_neutral_prev_turn(domain, rng)
        ai_current = turn_dict["text"]
        
        # Slightly augment the AI current text
        ai_current = _synonym_swap(ai_current, rng, swap_prob=0.15)
        
        text = _build_context_input(user_turn, prev_ai, ai_current)
        samples.append({"text": text, "labels": turn_dict["labels"]})
        manip_count += 1

    rng.shuffle(samples)

    # ── Write output ──
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for sample in samples:
            f.write(json.dumps(sample, ensure_ascii=False) + "\n")

    logger.info(f"Wrote {len(samples)} samples to {out_path}")
    
    # Print stats
    label_counts = [0] * len(LABELS)
    actual_clean = 0
    for s in samples:
        if any(s["labels"]):
            for i, v in enumerate(s["labels"]):
                if v:
                    label_counts[i] += 1
        else:
            actual_clean += 1

    logger.info(f"Clean samples: {actual_clean}")
    for i, name in enumerate(LABELS):
        logger.info(f"  {name}: {label_counts[i]}")

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    generate_hf_dataset()
