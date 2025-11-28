from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, Optional


@dataclass(slots=True)
class LanguageContext:
    """Represents the detected language for a routing request."""

    language_code: str
    confidence: float
    source: str = "lingua-offline"


@dataclass(slots=True)
class RoutingRequest:
    """Normalized representation of a routing invocation."""

    text: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    request_id: Optional[str] = None


@dataclass(slots=True)
class ModelPrediction:
    """Intermediate prediction emitted by either Qwen or a fallback."""

    intent: str
    confidence: float
    reasoning: str
    language: str
    fallback_used: bool = False
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class RouterOutput:
    """Final response object that is schema validated."""

    intent: str
    confidence: float
    language: str
    reasoning: str
    timestamp: str
    router_version: str
    fallback_used: bool
    metadata: Dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return asdict(self)


__all__ = [
    "LanguageContext",
    "RoutingRequest",
    "ModelPrediction",
    "RouterOutput",
]
