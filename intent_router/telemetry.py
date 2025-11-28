from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, MutableSequence, Optional


class ComplianceLogger:
    """Structured logger that mirrors the internal compliance_log sink."""

    def __init__(
        self,
        extra_context: Optional[Dict[str, Any]] = None,
        sink: Optional[MutableSequence[Dict[str, Any]]] = None,
    ) -> None:
        self.extra_context = extra_context or {}
        self.sink = sink
        self.logger = logging.getLogger("compliance_log")
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            handler.setFormatter(logging.Formatter("%(message)s"))
            self.logger.addHandler(handler)
        self.logger.propagate = False
        self.logger.setLevel(logging.INFO)

    def log_decision(self, event: Dict[str, Any]) -> None:
        payload = {**self.extra_context, **event}
        serialized = json.dumps(payload, default=str, ensure_ascii=False)
        self.logger.info(serialized)
        if self.sink is not None:
            self.sink.append(payload)


__all__ = ["ComplianceLogger"]
