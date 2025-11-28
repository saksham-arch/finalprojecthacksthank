from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from threading import Lock
from typing import Any, Deque, Dict, List
import time

from fastapi import HTTPException

from .compliance import ComplianceLogger
from .config import AppSettings, OutputValidationSettings, RateLimitSettings
from .models import InferenceRequest


@dataclass
class GuardOutcome:
    guard: str
    decision: str
    reason: str
    severity: str = "info"
    status_code: int = 200
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "guard": self.guard,
            "decision": self.decision,
            "reason": self.reason,
            "severity": self.severity,
            "metadata": self.metadata,
        }


class RateLimiter:
    def __init__(self, settings: RateLimitSettings) -> None:
        self.settings = settings
        self._requests: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, user_id: str) -> GuardOutcome:
        if not self.settings.enabled:
            return GuardOutcome(
                guard="rate_limit",
                decision="skipped",
                reason="rate limiting disabled",
            )
        now = time.monotonic()
        window = self.settings.window_seconds
        with self._lock:
            queue = self._requests[user_id]
            while queue and now - queue[0] > window:
                queue.popleft()
            if len(queue) >= self.settings.max_requests:
                retry_after = max(0, window - (now - queue[0])) if queue else window
                return GuardOutcome(
                    guard="rate_limit",
                    decision="blocked",
                    reason="per-user rate limit exceeded",
                    severity="high",
                    status_code=429,
                    metadata={
                        "max_requests": self.settings.max_requests,
                        "window_seconds": window,
                        "retry_after": round(retry_after, 2),
                    },
                )
            queue.append(now)
        remaining = max(0, self.settings.max_requests - len(self._requests[user_id]))
        return GuardOutcome(
            guard="rate_limit",
            decision="passed",
            reason=f"within rate limit ({remaining} remaining)",
            metadata={
                "max_requests": self.settings.max_requests,
                "window_seconds": window,
                "requests_in_window": len(self._requests[user_id]),
            },
        )

    def clear(self) -> None:
        with self._lock:
            self._requests.clear()


class OutputValidator:
    def __init__(self, settings: OutputValidationSettings) -> None:
        self.settings = settings

    def validate(self, response_text: str) -> GuardOutcome:
        if not self.settings.enabled:
            return GuardOutcome(
                guard="output_validation",
                decision="skipped",
                reason="output validation disabled",
            )
        lowered = response_text.lower()
        for term in self.settings.blocked_terms:
            if term.lower() in lowered:
                return GuardOutcome(
                    guard="output_validation",
                    decision="blocked",
                    reason=f"response contains disallowed term '{term}'",
                    severity="critical",
                    status_code=422,
                    metadata={"term": term},
                )
        return GuardOutcome(
            guard="output_validation",
            decision="passed",
            reason="response cleared deterministic validation",
        )


class SafetySuite:
    def __init__(self, settings: AppSettings, logger: ComplianceLogger) -> None:
        self.settings = settings
        self.logger = logger
        self.rate_limiter = RateLimiter(settings.safety.rate_limit)
        self.output_validator = OutputValidator(settings.safety.output_validation)
        self.blocklist = {entry.lower() for entry in settings.safety.financial_blocklist}

    def evaluate_request(self, request: InferenceRequest) -> List[GuardOutcome]:
        outcomes = [
            self._check_financial_blocklist(request),
            self._check_consent(request),
            self._check_rate_limit(request),
        ]
        return outcomes

    def validate_response(self, user_id: str, response_text: str) -> List[GuardOutcome]:
        outcome = self.output_validator.validate(response_text)
        self._persist(outcome, user_id)
        if outcome.decision == "blocked":
            raise HTTPException(status_code=outcome.status_code, detail=outcome.reason)
        return [outcome]

    def _check_financial_blocklist(self, request: InferenceRequest) -> GuardOutcome:
        if not self.settings.safety.financial_blocklist_enabled:
            outcome = GuardOutcome(
                guard="financial_blocklist",
                decision="skipped",
                reason="financial blocklist disabled",
            )
        elif request.user_id.lower() in self.blocklist:
            outcome = GuardOutcome(
                guard="financial_blocklist",
                decision="blocked",
                reason="user is on the financial blocklist",
                severity="critical",
                status_code=403,
                metadata={"user_id": request.user_id},
            )
        else:
            outcome = GuardOutcome(
                guard="financial_blocklist",
                decision="passed",
                reason="user cleared blocklist",
            )
        self._persist(outcome, request.user_id)
        if outcome.decision == "blocked":
            raise HTTPException(status_code=outcome.status_code, detail=outcome.reason)
        return outcome

    def _check_consent(self, request: InferenceRequest) -> GuardOutcome:
        if not self.settings.safety.consent_required:
            outcome = GuardOutcome(
                guard="consent",
                decision="skipped",
                reason="consent verification disabled",
            )
        elif not request.consent:
            outcome = GuardOutcome(
                guard="consent",
                decision="blocked",
                reason="explicit consent missing",
                severity="high",
                status_code=412,
                metadata={"channel": request.channel},
            )
        else:
            outcome = GuardOutcome(
                guard="consent",
                decision="passed",
                reason="consent verified",
            )
        self._persist(outcome, request.user_id)
        if outcome.decision == "blocked":
            raise HTTPException(status_code=outcome.status_code, detail=outcome.reason)
        return outcome

    def _check_rate_limit(self, request: InferenceRequest) -> GuardOutcome:
        outcome = self.rate_limiter.check(request.user_id)
        self._persist(outcome, request.user_id)
        if outcome.decision == "blocked":
            raise HTTPException(status_code=outcome.status_code, detail=outcome.reason)
        return outcome

    def _persist(self, outcome: GuardOutcome, user_id: str) -> None:
        self.logger.log_decision(
            guard=outcome.guard,
            decision=outcome.decision,
            user_id=user_id,
            reason=outcome.reason,
            severity=outcome.severity,
            metadata={**outcome.metadata, "timestamp": datetime.now(timezone.utc).isoformat()},
        )


__all__ = ["SafetySuite", "GuardOutcome", "RateLimiter", "OutputValidator"]
