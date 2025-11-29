from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Sequence, Tuple

from .exceptions import RouterConfigurationError


DEFAULT_LABELS: Tuple[str, ...] = (
    "general_inquiry",
    "billing_support",
    "technical_support",
    "sales_inquiry",
    "account_security",
)


@dataclass(slots=True)
class IntentRouterConfig:
    """Configuration envelope for the offline Qwen intent router."""

    model_path: Path
    router_version: str = "qwen-30b-intent-router"
    max_batch_size: int = 4
    max_prompt_chars: int = 2048
    latency_budget_seconds: float = 4.0
    memory_budget_bytes: int = 2 * 1024 ** 3
    classification_labels: Sequence[str] = field(default_factory=lambda: DEFAULT_LABELS)
    compliance_log_context: Dict[str, str] = field(default_factory=dict)
    fallback_timeout_seconds: float = 0.3
    offline_mode: bool = False

    def __post_init__(self) -> None:
        path = Path(self.model_path)
        if not path.exists():
            raise RouterConfigurationError(
                f"Local Qwen weights expected at '{path}' but were not found."
            )
        if self.max_batch_size <= 0:
            raise RouterConfigurationError("max_batch_size must be greater than zero")
        if self.max_prompt_chars <= 0:
            raise RouterConfigurationError("max_prompt_chars must be greater than zero")
        self.model_path = path
        self.classification_labels = tuple(self.classification_labels)
