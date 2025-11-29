from __future__ import annotations

import math
from typing import Dict, Iterable, Tuple

from .types import LanguageContext


class LinguaLanguageDetector:
    """Lightweight offline approximation of a Lingua detector."""

    _KEYWORDS: Dict[str, Tuple[str, ...]] = {
        "en": (
            "help",
            "billing",
            "password",
            "support",
            "upgrade",
            "cancel",
        ),
        "es": (
            "factura",
            "ayuda",
            "contraseña",
            "soporte",
            "precio",
            "cancelar",
        ),
        "fr": (
            "facture",
            "assistance",
            "mot de passe",
            "prix",
        ),
        "de": (
            "rechnung",
            "hilfe",
            "kennwort",
            "preis",
        ),
        "zh": (
            "价格",
            "帮助",
            "支持",
            "发票",
        ),
    }

    _UNIQUE_CHARS: Dict[str, Tuple[str, ...]] = {
        "es": ("ñ", "á", "é", "í", "ó", "ú"),
        "fr": ("à", "ç", "è", "é", "ù"),
        "de": ("ä", "ö", "ü", "ß"),
        "zh": ("你", "们", "客", "户"),
    }

    def detect(self, text: str) -> LanguageContext:
        normalized = text.strip().lower()
        if not normalized:
            return LanguageContext(language_code="en", confidence=0.0)

        best_code = "en"
        best_score = -math.inf

        for code, keywords in self._KEYWORDS.items():
            keyword_score = sum(1.0 for keyword in keywords if keyword in normalized)
            char_score = self._score_characters(code, normalized)
            combined = keyword_score + char_score * 1.5
            if combined > best_score:
                best_score = combined
                best_code = code

        max_possible = len(self._KEYWORDS.get(best_code, ())) + len(
            self._UNIQUE_CHARS.get(best_code, ())
        ) * 1.5
        confidence = 0.0 if max_possible == 0 else min(best_score / max_possible, 1.0)

        return LanguageContext(language_code=best_code, confidence=confidence)

    def _score_characters(self, code: str, normalized: str) -> float:
        unique_chars: Iterable[str] = self._UNIQUE_CHARS.get(code, tuple())
        return sum(1.0 for char in unique_chars if char in normalized)


__all__ = ["LinguaLanguageDetector"]
