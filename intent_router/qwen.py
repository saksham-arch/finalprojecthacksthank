from __future__ import annotations

import re
from typing import Iterable, List, Sequence

from .config import IntentRouterConfig
from .exceptions import FinancialAdviceViolation, RouterModelUnavailableError
from .types import LanguageContext, ModelPrediction, RoutingRequest


class LightweightQwenIntentModel:
    """Offline-friendly heuristic wrapper that emulates Qwen 30B classification."""

    _INTENT_PATTERNS = {
        "billing_support": (
            re.compile(r"billing|invoice|refund|factura|facture|rechnung", re.I),
        ),
        "technical_support": (
            re.compile(r"error|bug|issue|problema|falla|störung", re.I),
        ),
        "sales_inquiry": (
            re.compile(r"buy|purchase|pricing|quote|precio|cotización", re.I),
        ),
        "account_security": (
            re.compile(r"password|login|contraseña|kennwort|mot de passe", re.I),
        ),
        "general_inquiry": (re.compile(r".*", re.S),),
    }

    _FINANCIAL_GUARDRAIL = re.compile(
        r"financial advice|stock tip|investment recommendation|crypto pick",
        re.I,
    )

    def __init__(self, config: IntentRouterConfig):
        self.config = config

    def classify(
        self,
        requests: Sequence[RoutingRequest],
        languages: Sequence[LanguageContext],
    ) -> List[ModelPrediction]:
        if self.config.offline_mode:
            raise RouterModelUnavailableError("Offline mode enforced; model skipped")

        predictions: List[ModelPrediction] = []
        for request, language in zip(requests, languages):
            prompt = self._build_prompt(request.text, language.language_code)
            truncated_text = request.text.strip()[: self.config.max_prompt_chars]
            self._enforce_financial_guardrail(truncated_text)
            intent, reasoning = self._infer_intent(truncated_text)
            confidence = 0.9 if intent != "general_inquiry" else 0.6
            metadata = {
                "language_detector_confidence": language.confidence,
                "prompt_excerpt": prompt[:160],
                "model_path": str(self.config.model_path),
                "classification_labels": list(self.config.classification_labels),
            }
            predictions.append(
                ModelPrediction(
                    intent=intent,
                    confidence=confidence,
                    reasoning=reasoning,
                    language=language.language_code,
                    fallback_used=False,
                    metadata=metadata,
                )
            )
        return predictions

    def _build_prompt(self, text: str, language_code: str) -> str:
        safe_text = text.replace("`", "\u0060")
        labels = ", ".join(self.config.classification_labels)
        return (
            "System: You are Qwen-30B operating fully offline with local weights."
            " Classify the provided utterance into one of the following intents: "
            f"{labels}. Only return the canonical intent name and reasoning. "
            f"User language={language_code}. Utterance: ```{safe_text}```"
        )

    def _infer_intent(self, text: str) -> tuple[str, str]:
        for intent, patterns in self._INTENT_PATTERNS.items():
            for pattern in patterns:
                if pattern.search(text):
                    reasoning = f"Matched lexical pattern '{pattern.pattern}'"
                    return intent, reasoning
        return "general_inquiry", "No high-confidence lexical match"

    def _enforce_financial_guardrail(self, text: str) -> None:
        if self._FINANCIAL_GUARDRAIL.search(text):
            raise FinancialAdviceViolation(
                "Financial advice prompts are not permitted in the intent router"
            )


__all__ = ["LightweightQwenIntentModel"]
