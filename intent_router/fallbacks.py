from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional

from .types import LanguageContext, ModelPrediction, RoutingRequest


@dataclass(frozen=True)
class FallbackRule:
    name: str
    intent: str
    pattern: re.Pattern[str]
    reasoning: str


def _compile_default_rules() -> List[FallbackRule]:
    keywords = {
        "billing": r"billing|invoice|refund|factura|facture|rechnung|reembolso",
        "security": r"password|login|contraseña|mot de passe|kennwort",
        "sales": r"buy|purchase|quote|precio|cotización|angebot",
        "technical": r"error|bug|issue|falla|problema|panne",
        "cancellation": r"cancel|close account|cerrar|annuler",
    }
    reasoning_templates = {
        "billing": "Billing lexicon matched during offline fallback",
        "security": "Account security lexicon matched during offline fallback",
        "sales": "Sales lexicon matched during offline fallback",
        "technical": "Technical support lexicon matched during offline fallback",
        "cancellation": "Cancellation keywords detected while offline",
    }
    intents = {
        "billing": "billing_support",
        "security": "account_security",
        "sales": "sales_inquiry",
        "technical": "technical_support",
        "cancellation": "general_inquiry",
    }

    compiled: List[FallbackRule] = []
    for name, regex in keywords.items():
        compiled.append(
            FallbackRule(
                name=name,
                intent=intents[name],
                pattern=re.compile(regex, re.IGNORECASE),
                reasoning=reasoning_templates[name],
            )
        )
    return compiled


class RegexFallbackRouter:
    """Deterministic safety net when the LLM is offline or times out."""

    def __init__(self, rules: Optional[Iterable[FallbackRule]] = None):
        self.rules: List[FallbackRule] = list(rules) if rules is not None else _compile_default_rules()

    def route(
        self,
        request: RoutingRequest,
        language: LanguageContext,
        offline_reason: str,
    ) -> ModelPrediction:
        normalized = request.text.lower().strip()
        for rule in self.rules:
            if rule.pattern.search(normalized):
                metadata = {
                    "fallback_rule": rule.name,
                    "fallback_reason": offline_reason,
                    "language_detector_confidence": language.confidence,
                }
                return ModelPrediction(
                    intent=rule.intent,
                    confidence=0.75,
                    reasoning=rule.reasoning,
                    language=language.language_code,
                    fallback_used=True,
                    metadata=metadata,
                )

        metadata = {
            "fallback_rule": "default",
            "fallback_reason": offline_reason,
            "language_detector_confidence": language.confidence,
        }
        return ModelPrediction(
            intent="general_inquiry",
            confidence=0.45,
            reasoning="Default fallback route engaged",
            language=language.language_code,
            fallback_used=True,
            metadata=metadata,
        )


__all__ = ["RegexFallbackRouter", "FallbackRule"]
