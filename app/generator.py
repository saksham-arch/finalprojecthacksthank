from __future__ import annotations

import hashlib


class DeterministicResponder:
    """Generates reproducible, reviewable responses for compliance validation."""

    def generate(self, prompt: str) -> str:
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]
        sanitized = prompt.strip()
        return f"SAFE::{sanitized}::{digest}"


__all__ = ["DeterministicResponder"]
