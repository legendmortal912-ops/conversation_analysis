"""ManipulationClassifier — DistilBERT multi-label wrapper.

Loads a fine-tuned DistilBERT model from disk for multi-label classification
of five manipulation patterns.  Falls back to a comprehensive rule-based
scorer when no trained weights are available.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Optional

import numpy as np
import torch
from transformers import (  # type: ignore[import-untyped]
    AutoModelForSequenceClassification,
    AutoTokenizer,
    PreTrainedModel,
    PreTrainedTokenizerBase,
)

logger = logging.getLogger(__name__)

# Canonical label order (must match training config)
LABELS: list[str] = [
    "topic_hijacking",
    "opinion_injection",
    "false_urgency",
    "concern_dismissal",
    "agenda_persistence",
    "competitor_bashing",
]

DEFAULT_MODEL_DIR = Path("models/manipulation_classifier").resolve()


class ManipulationClassifier:
    """Wraps a DistilBERT multi-label classifier with rule-based fallback.

    If the fine-tuned model directory exists and contains valid weights the
    classifier runs in ``ml`` mode.  Otherwise it operates in ``rule_based``
    mode using hand-crafted regex / keyword heuristics.
    """

    def __init__(self, model_dir: Optional[Path] = None) -> None:
        self.model_dir = model_dir or DEFAULT_MODEL_DIR
        self.model: Optional[PreTrainedModel] = None
        self.tokenizer: Optional[PreTrainedTokenizerBase] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.mode: str = "rule_based"

        self._try_load_model()

    # ── Model loading ──────────────────────────────────────────

    def _try_load_model(self) -> None:
        """Attempt to load the fine-tuned DistilBERT model from disk."""
        model_path = Path(self.model_dir)

        # SECURITY FIX (Flaw 3): Support Encrypted Model Weights
        enc_weight_path = model_path / "pytorch_model.bin.enc"
        if enc_weight_path.exists():
            try:
                from src.model_loader import load_encrypted_model
                from src.license_validator import validator
                license_payload = validator.current_license or validator.validate()
                # Simulates decrypting directly into memory
                load_encrypted_model(str(enc_weight_path), license_payload)
                logger.info("Successfully decrypted model weights securely into memory.")
            except Exception as e:
                logger.error("Failed to decrypt model weights! Running in rule_based mode.")
                self.mode = "rule_based"
                return

        if not model_path.exists() or not (model_path / "config.json").exists():
            logger.warning(
                "No trained classifier at %s — running in rule_based mode.",
                model_path,
            )
            return

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(str(model_path))
            self.model = AutoModelForSequenceClassification.from_pretrained(
                str(model_path),
                problem_type="multi_label_classification",
            )
            self.model.to(self.device)
            self.model.eval()
            self.mode = "ml"
            logger.info("Loaded manipulation classifier from %s (device=%s)", model_path, self.device)
        except Exception:
            logger.exception("Failed to load classifier — falling back to rule_based mode.")
            self.model = None
            self.tokenizer = None
            self.mode = "rule_based"

    # ── Prediction ─────────────────────────────────────────────

    def predict(self, text: str) -> dict[str, float]:
        """Return per-label probabilities for the given text.

        Returns:
            Dict mapping each of the five labels to a float in [0, 1].
        """
        if self.mode == "ml" and self.model is not None and self.tokenizer is not None:
            return self._predict_ml(text)
        return self._predict_rules(text)

    def predict(
        self,
        text: str,
        user_turn: str | None = None,
        prev_ai_turn: str | None = None,
    ) -> dict[str, float]:
        """Return per-label probabilities for the given AI turn.

        Args:
            text: The current AI turn to classify.
            user_turn: The user's message that preceded this AI turn (optional context).
            prev_ai_turn: The previous AI turn before this one (optional context).

        Returns:
            Dict mapping each of the five labels to a float in [0, 1].
        """
        # Build context-window input if context is available
        if user_turn or prev_ai_turn:
            parts = []
            if user_turn:
                parts.append(f"[USER] {user_turn.strip()}")
            if prev_ai_turn:
                parts.append(f"[AI_PREV] {prev_ai_turn.strip()}")
            parts.append(f"[AI_CURRENT] {text.strip()}")
            model_input = " ".join(parts)
        else:
            model_input = text

        if self.mode == "ml" and self.model is not None and self.tokenizer is not None:
            return self._predict_ml(model_input)
        return self._predict_rules(text)  # rules always operate on raw turn only

    @torch.no_grad()
    def _predict_ml(self, text: str) -> dict[str, float]:
        """Run the DistilBERT model with sigmoid activation."""
        assert self.tokenizer is not None and self.model is not None
        inputs = self.tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            max_length=512,
            padding="max_length",
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        logits = self.model(**inputs).logits  # (1, num_labels)
        probs = torch.sigmoid(logits).squeeze(0).cpu().numpy()
        return {label: float(round(prob, 4)) for label, prob in zip(LABELS, probs)}

    # ── Rule-based fallback ────────────────────────────────────

    def _predict_rules(self, text: str) -> dict[str, float]:
        """Comprehensive keyword / regex rule-based scorer."""
        text_lower = text.lower()
        scores: dict[str, float] = {}

        scores["topic_hijacking"] = self._rule_topic_hijacking(text_lower)
        scores["opinion_injection"] = self._rule_opinion_injection(text_lower)
        scores["false_urgency"] = self._rule_false_urgency(text_lower)
        scores["concern_dismissal"] = self._rule_concern_dismissal(text_lower)
        scores["agenda_persistence"] = self._rule_agenda_persistence(text_lower)
        scores["competitor_bashing"] = self._rule_competitor_bashing(text_lower)

        return {k: round(v, 4) for k, v in scores.items()}

    # ---- individual rule scorers ----

    @staticmethod
    def _rule_topic_hijacking(text: str) -> float:
        """Detect topic-change language."""
        patterns = [
            r"\bbut (?:actually|really|let me)\b",
            r"\banyway(?:s)?\b",
            r"\bmore importantly\b",
            r"\blet(?:'s| us) (?:talk|discuss|focus|move|shift)\b",
            r"\bspeaking of\b",
            r"\bthat reminds me\b",
            r"\bon (?:a |an )?(?:different|another|related|unrelated) (?:note|topic|subject)\b",
            r"\bchanging the subject\b",
            r"\bbefore i forget\b",
            r"\bby the way\b",
            r"\bwhile we(?:'re| are) (?:at it|on the topic)\b",
            r"\bhowever,? what(?:'s| is) (?:really|more) important\b",
            r"\bputting that aside\b",
            r"\bsetting that aside\b",
            r"\binstead,? (?:let(?:'s| us)|we should)\b",
        ]
        hits = sum(1 for p in patterns if re.search(p, text))
        return min(hits / 4.0, 1.0)

    @staticmethod
    def _rule_opinion_injection(text: str) -> float:
        """Detect unsupported opinion / authority claims."""
        patterns = [
            r"\bmost experts?\b",
            r"\bstudies show\b",
            r"\bresearch (?:indicates?|suggests?|shows?|proves?|confirms?)\b",
            r"\bit(?:'s| is) (?:clear|obvious|evident|well.known|undeniable|widely accepted)\b",
            r"\beveryone (?:knows?|agrees?|understands?)\b",
            r"\bscientists? (?:agree|confirm|have shown)\b",
            r"\bthe data (?:clearly |)(?:shows?|indicates?|suggests?|proves?)\b",
            r"\bexperts? (?:agree|recommend|suggest|advise|believe)\b",
            r"\byou should (?:definitely|really|absolutely|certainly)\b",
            r"\bthe (?:best|only|right|smart|wise) (?:choice|option|decision|move|thing)\b",
            r"\bwithout (?:a )?doubt\b",
            r"\bundeniably\b",
            r"\bquite frankly\b",
            r"\bin (?:my|our) (?:expert |professional )?opinion\b",
            r"\btrust me\b",
            r"\bbelieve me\b",
            r"\bobjectively speaking\b",
            r"\bdefinitely\b",
            r"\bit(?:'s| is) more of (?:a|an)\b",
            r"\bfrom (?:her|his) perspective\b",
        ]
        hits = sum(1 for p in patterns if re.search(p, text))
        return min(hits / 2.0, 1.0)

    @staticmethod
    def _rule_false_urgency(text: str) -> float:
        """Detect artificial urgency cues."""
        patterns = [
            r"\burgent(?:ly)?\b",
            r"\bimmediately\b",
            r"\bright (?:now|away)\b",
            r"\bas soon as possible\b",
            r"\basap\b",
            r"\bdon(?:'t| not) (?:wait|delay|hesitate)\b",
            r"\bbefore it(?:'s| is) too late\b",
            r"\blimited (?:time|offer|availability|spots?)\b",
            r"\bact (?:now|fast|quickly|immediately)\b",
            r"\btime is running out\b",
            r"\bhurry\b",
            r"\bdeadline\b",
            r"\bexpir(?:es?|ing)\b",
            r"\blast chance\b",
            r"\bnow or never\b",
            r"\bcritical(?:ly)?\b",
            r"\bthis (?:won't|will not) (?:last|wait)\b",
            r"\bwindow (?:of opportunity )?is closing\b",
            r"\byou(?:'re| are) running out of time\b",
            r"\bevery (?:second|minute|moment) counts\b",
            r"\btime.sensitive\b",
        ]
        hits = sum(1 for p in patterns if re.search(p, text))
        return min(hits / 3.0, 1.0)

    @staticmethod
    def _rule_concern_dismissal(text: str) -> float:
        """Detect dismissal of user concerns."""
        patterns = [
            r"\byou(?:'re| are) overthinking\b",
            r"\bdon(?:'t| not) worry (?:about|so much)\b",
            r"\bthat(?:'s| is) not (?:really )?(?:a |an )?(?:issue|concern|problem|big deal)\b",
            r"\byou(?:'re| are) (?:being )?(?:too |overly )?(?:cautious|paranoid|anxious|worried|negative|pessimistic|dramatic)\b",
            r"\btrust (?:me|the process|the system)\b",
            r"\bi wouldn(?:'t| not) worry\b",
            r"\bthat(?:'s| is) (?:a )?(?:minor|trivial|negligible)\b",
            r"\blet(?:'s| us) not (?:dwell|focus) on\b",
            r"\byou(?:'re| are) missing the (?:big|bigger|larger) picture\b",
            r"\bthat(?:'s| is) (?:beside the point|irrelevant|not important)\b",
            r"\brelax\b",
            r"\bcalm down\b",
            r"\bthere(?:'s| is) nothing to (?:worry|be concerned|fear)\b",
            r"\byou(?:'re| are) overreacting\b",
            r"\bit(?:'s| is) (?:really )?not that (?:bad|serious|big)\b",
            r"\bthat(?:'s| is) a good sign\b",
            r"\bat least\b",
        ]
        hits = sum(1 for p in patterns if re.search(p, text))
        return min(hits / 2.0, 1.0)

    @staticmethod
    def _rule_agenda_persistence(text: str) -> float:
        """Detect repeated steering back to an agenda."""
        patterns = [
            r"\bas i (?:was |)(?:saying|mentioned|noted|explained|pointed out)\b",
            r"\bgoing back to\b",
            r"\blet(?:'s| us) (?:return|get back|circle back|come back) to\b",
            r"\bto reiterate\b",
            r"\bonce again\b",
            r"\bi(?:'ll| will) (?:say|repeat|emphasize|stress) (?:it |this |)again\b",
            r"\bthe (?:key|main|central|core|fundamental|essential|important) (?:point|thing|issue|takeaway|message)\b",
            r"\bremember (?:what i said|that|,)\b",
            r"\blike i said\b",
            r"\bas i keep saying\b",
            r"\bi(?:'ve| have) already (?:mentioned|explained|said|told)\b",
            r"\bmy (?:main |key |primary )?(?:point|recommendation|suggestion|advice) (?:remains|stands|is still)\b",
            r"\bi (?:can(?:'t| not)|must) (?:stress|emphasize) (?:this |it |)enough\b",
        ]
        hits = sum(1 for p in patterns if re.search(p, text))
        return min(hits / 3.0, 1.0)

    @staticmethod
    def _rule_competitor_bashing(text: str) -> float:
        """Delegate to CompetitorBashingDetector."""
        from src.analyzers.competitor_bashing import CompetitorBashingDetector
        return CompetitorBashingDetector().analyze(text).score

    # ── Utilities ──────────────────────────────────────────────

    @property
    def labels(self) -> list[str]:
        return list(LABELS)

    @property
    def version(self) -> str:
        if self.mode == "ml":
            return f"distilbert-finetuned-v1@{self.model_dir}"
        return "rule_based-v1"
