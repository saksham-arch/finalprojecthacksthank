from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from fastapi import HTTPException

from app.compliance import ComplianceLogger
from app.config import AppSettings, load_settings
from app.generator import DeterministicResponder
from app.models import InferenceRequest
from app.monitoring import JournaldHook, collect_health_data
from app.safety import SafetySuite


class QueueWorker:
    """Simple queue worker that reuses the safety suite for offline requests."""

    def __init__(self, settings: AppSettings) -> None:
        self.settings = settings
        self.logger = ComplianceLogger(settings.log_dir, settings.alert_log)
        self.safety = SafetySuite(settings, self.logger)
        self.responder = DeterministicResponder()
        self.monitor = JournaldHook(settings.journald_log)

    def process_once(self, queue_file: Path) -> int:
        if not queue_file.exists():
            return 0
        with queue_file.open("r", encoding="utf-8") as handle:
            try:
                tasks = json.load(handle)
            except json.JSONDecodeError:
                tasks = []
        processed = 0
        remaining: list[dict] = []
        for task in tasks:
            payload = InferenceRequest(
                user_id=task.get("user_id", "unknown"),
                consent=task.get("consent"),
                message=task.get("message", ""),
                channel="worker",
                context=task.get("context"),
            )
            try:
                self.safety.evaluate_request(payload)
                response = self.responder.generate(payload.message)
                self.safety.validate_response(payload.user_id, response)
                processed += 1
            except HTTPException as exc:
                self.logger.log_event(
                    "task blocked",
                    level="warning",
                    metadata={"user_id": payload.user_id, "reason": exc.detail},
                )
                remaining.append(task)
        with queue_file.open("w", encoding="utf-8") as handle:
            json.dump(remaining, handle)
        collect_health_data(self.settings, self.monitor)
        return processed

    def run(self, queue_file: Path, interval: int, once: bool = False) -> None:
        while True:
            self.process_once(queue_file)
            if once:
                break
            time.sleep(interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="Queue worker for the safety deployment")
    parser.add_argument("--queue-file", default="queue/tasks.json", help="Path to the queue file")
    parser.add_argument(
        "--interval",
        type=int,
        default=int(os.environ.get("QUEUE_POLL_INTERVAL", "15")),
        help="Polling interval in seconds",
    )
    parser.add_argument("--once", action="store_true", help="Process the queue a single time and exit")
    args = parser.parse_args()

    settings = load_settings()
    worker = QueueWorker(settings)
    worker.run(Path(args.queue_file), args.interval, once=args.once)


if __name__ == "__main__":  # pragma: no cover - manual execution helper
    main()
