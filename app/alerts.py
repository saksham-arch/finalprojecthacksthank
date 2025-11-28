from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict
import json


class AlertManager:
    """Dispatch high-priority safety breaches to an alert log."""

    def __init__(self, log_path: str) -> None:
        self.path = Path(log_path)
        self._lock = Lock()
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def emit(self, entry: Dict[str, Any]) -> None:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **entry,
        }
        with self._lock:
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


__all__ = ["AlertManager"]
