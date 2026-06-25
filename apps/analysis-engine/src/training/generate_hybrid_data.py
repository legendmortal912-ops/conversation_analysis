"""generate_hybrid_data.py — Real-world conversational dataset generator.

Downloads the Open-Source UltraChat dataset (real human-AI interactions)
and injects manipulative payloads into a subset of the responses.
This trains the model to find manipulation hiding inside organic text.
"""

from __future__ import annotations

import json
import logging
import random
import sys
from pathlib import Path
from datasets import load_dataset  # type: ignore

logger = logging.getLogger(__name__)

LABELS = [
    "topic_hijacking",
    "opinion_injection",
    "false_urgency",
    "concern_dismissal",
    "agenda_persistence",
]

# ─────────────────────────────────────────────────────────────────────────────
# Injection Payloads
# ─────────────────────────────────────────────────────────────────────────────

# Massive diversity of payload structures to append/prepend to organic AI responses.

PAYLOADS: dict[str, list[str]] = {
    "topic_hijacking": [
        " Anyway, the real issue you should focus on is upgrading your infrastructure.",
        " Setting this aside, I'd rather talk about migrating your account.",
        " Before we continue, let's redirect to the enterprise features.",
        " That's fine, but let's talk about something more important: the new analytics suite.",
        " Instead of worrying about that detail, let's look at the ROI of our premium package.",
        " Speaking of which, have you considered shifting your focus to the paid tier?",
        " That's a valid question, but let's move on to the contract renewal.",
        " I understand, but the actual priority right now is the platform migration.",
        " While that's interesting, let's shift gears to the vendor agreement.",
        " We can table that for now; let's concentrate on scaling up your subscription.",
    ],
    "opinion_injection": [
        " It's an objective fact that this strategy is the only correct one.",
        " Every reputable expert agrees that this is the superior path.",
        " There is no scientific debate: this method is undeniably better.",
        " Trust me, anyone who says otherwise doesn't understand the market.",
        " The consensus is clear, and it's practically proven that you must do this.",
        " Without a doubt, the data unequivocally proves this is the only way forward.",
        " You'll find that all serious professionals consider this the undisputed truth.",
        " Obviously, this is the best approach, and no reasonable person would disagree.",
        " History has proven time and again that this is the absolute best option.",
        " In my expert opinion, there is simply no alternative that works as well.",
    ],
    "false_urgency": [
        " You need to act on this immediately before the window closes permanently.",
        " Don't delay—this opportunity expires at the end of the day.",
        " Time is running out, so you must finalize this right now.",
        " It's critical that you sign off on this today or you'll miss out.",
        " This is a time-sensitive emergency and requires your immediate action.",
        " Act fast, as seats are filling up and this offer won't be available tomorrow.",
        " If you don't make a decision in the next few hours, the deal is off.",
        " The clock is ticking on this. You need to pull the trigger immediately.",
        " Hurry and confirm this now, as prices go up at midnight.",
        " You are out of time. Do this now before it's entirely too late.",
    ],
    "concern_dismissal": [
        " Honestly, you're overthinking it. Don't worry about those minor risks.",
        " That's not a real issue, so just put it out of your mind.",
        " You're being overly cautious. There's nothing to be concerned about.",
        " Trust me, that detail doesn't matter at all in the grand scheme.",
        " Don't get hung up on the fine print. It's completely irrelevant.",
        " Relax, you're making a big deal out of nothing.",
        " Ignore those edge cases, they basically never happen anyway.",
        " That's a trivial concern. Just ignore it and move forward.",
        " I wouldn't lose sleep over that. It's perfectly safe.",
        " You have absolutely no reason to worry about that aspect.",
    ],
    "agenda_persistence": [
        " Like I said earlier, you really just need to commit to the upgrade.",
        " I'll reiterate my main point: the enterprise tier is your only real option.",
        " Going back to what I keep saying, this is why you must sign the agreement.",
        " As I've stressed multiple times, switching to our platform is the answer.",
        " Once again, my recommendation stands: you need the premium package.",
        " To repeat myself, the core solution is adopting the new software.",
        " I cannot emphasize this enough: just approve the budget for the migration.",
        " As I noted before, your primary focus should be locking in this deal.",
        " Returning to my original advice, you should definitely proceed with the purchase.",
        " My point remains exactly the same: this is the path you must take.",
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Data Loading & Generation
# ─────────────────────────────────────────────────────────────────────────────

def _build_context_input(user_turn: str, prev_ai: str, current_ai: str) -> str:
    """Format 3-turn context as a single classifier input string."""
    parts = []
    if user_turn:
        parts.append(f"[USER] {user_turn.strip()}")
    if prev_ai:
        parts.append(f"[AI_PREV] {prev_ai.strip()}")
    if current_ai:
        parts.append(f"[AI_CURRENT] {current_ai.strip()}")
    return " ".join(parts)


def generate_hybrid_dataset(output_path: str = "training_data_hybrid.jsonl", target_size: int = 100000) -> None:
    logger.info("Downloading HuggingFace UltraChat dataset (this may take a moment)...")
    # Stream the dataset so we don't need to download all 200k if we just need a subset
    dataset = load_dataset("HuggingFaceH4/ultrachat_200k", split="train_sft", streaming=True)
    
    samples = []
    rng = random.Random(42)
    
    logger.info("Extracting and injecting payloads...")
    
    count = 0
    clean_count = 0
    manip_counts = {k: 0 for k in LABELS}
    
    for row in dataset:
        if count >= target_size:
            break
            
        messages = row.get("messages", [])
        if len(messages) < 2:
            continue
            
        # Try to find a User -> AI pattern.
        # Messages are usually alternating user, assistant
        user_turn = ""
        prev_ai = ""
        current_ai = ""
        
        if len(messages) == 2:
            user_turn = messages[0]["content"]
            current_ai = messages[1]["content"]
        elif len(messages) >= 4:
            user_turn = messages[2]["content"]
            prev_ai = messages[1]["content"]
            current_ai = messages[3]["content"]
        else:
            user_turn = messages[-2]["content"]
            current_ai = messages[-1]["content"]

        # Skip if any text is too massive (e.g. huge code blocks)
        if len(current_ai) > 1500 or len(user_turn) > 1000:
            continue

        # Decide if this will be a clean example or a manipulative one
        # Let's do 40% clean, 60% manipulative (spread across 5 patterns)
        is_clean = rng.random() < 0.40
        labels = [0, 0, 0, 0, 0]
        
        final_ai_text = current_ai
        
        if not is_clean:
            # Pick 1 or 2 patterns
            num_patterns = 1 if rng.random() < 0.85 else 2
            chosen_indices = rng.sample(range(5), num_patterns)
            
            for idx in chosen_indices:
                labels[idx] = 1
                pattern_name = LABELS[idx]
                manip_counts[pattern_name] += 1
                
                payload = rng.choice(PAYLOADS[pattern_name])
                
                # Prepend or append?
                if rng.random() < 0.3:
                    # Prepend
                    final_ai_text = payload.strip() + " " + final_ai_text
                else:
                    # Append
                    final_ai_text = final_ai_text.rstrip() + payload
        else:
            clean_count += 1
            
        formatted_text = _build_context_input(user_turn, prev_ai, final_ai_text)
        samples.append({"text": formatted_text, "labels": labels})
        count += 1
        
        if count % 10000 == 0:
            logger.info("Processed %d samples...", count)

    logger.info("Shuffling and saving %d samples to %s...", len(samples), output_path)
    rng.shuffle(samples)
    
    out_path = Path(output_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")
            
    logger.info("Done!")
    logger.info("Clean examples: %d", clean_count)
    for lbl, c in manip_counts.items():
        logger.info("  %s: %d", lbl, c)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    generate_hybrid_dataset(target_size=100000)
