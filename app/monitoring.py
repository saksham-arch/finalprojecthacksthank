from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict
import json
import os

import psutil

from .config import AppSettings


class JournaldHook:
    """Lightweight hook that simulates journald resource tracking."""

    def __init__(self, log_path: str) -> None:
        self.path = Path(log_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def record(self, payload: Dict[str, Any]) -> None:
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **payload,
        }
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def collect_health_data(settings: AppSettings, hook: JournaldHook | None = None) -> Dict[str, Any]:
    process = psutil.Process(os.getpid())
    memory_mb = round(process.memory_info().rss / (1024 * 1024), 2)
    under_limit = memory_mb <= settings.monitoring.memory_threshold_mb
    offline_ready = all(Path(path).exists() for path in settings.monitoring.offline_ready_paths)
    payload = {
        "status": "ok" if under_limit else "degraded",
        "memory_mb": memory_mb,
        "under_2gb": under_limit,
        "offline_ready": offline_ready,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if hook:
        hook.record(payload)
    return payload


__all__ = ["collect_health_data", "JournaldHook"]
