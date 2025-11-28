from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict
import json

from .alerts import AlertManager


class ComplianceLogger:
    """Structured logger that records every safety decision."""

    def __init__(self, log_dir: str, alert_path: str) -> None:
        self.log_path = Path(log_dir) / "compliance.log"
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self.alerts = AlertManager(alert_path)

    def log_decision(
        self,
        *,
        guard: str,
        decision: str,
        user_id: str,
        reason: str,
        severity: str,
        metadata: Dict[str, Any] | None = None,
    ) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "guard": guard,
            "decision": decision,
            "user_id": user_id,
            "reason": reason,
            "severity": severity,
            "metadata": metadata or {},
        }
        with self._lock:
            with self.log_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
        if decision == "blocked":
            self.alerts.emit({
                "guard": guard,
                "user_id": user_id,
                "reason": reason,
                "severity": severity,
                "metadata": metadata or {},
            })

    def log_event(self, message: str, *, level: str = "info", metadata: Dict[str, Any] | None = None) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event": message,
            "level": level,
            "metadata": metadata or {},
        }
        with self._lock:
            with self.log_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


__all__ = ["ComplianceLogger"]
