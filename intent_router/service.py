from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Iterable, List, Sequence

from .config import IntentRouterConfig
from .exceptions import (
    MemoryBudgetExceeded,
    RouterModelUnavailableError,
    RouterTimeoutError,
)
from .fallbacks import RegexFallbackRouter
from .language_detection import LinguaLanguageDetector
from .qwen import LightweightQwenIntentModel
from .schema import validate_router_output
from .telemetry import ComplianceLogger
from .types import LanguageContext, ModelPrediction, RouterOutput, RoutingRequest


class IntentRouterService:
    """Coordinates language detection, Qwen inference, and fallbacks."""

    def __init__(
        self,
        config: IntentRouterConfig,
        llm_client: LightweightQwenIntentModel | None = None,
        language_detector: LinguaLanguageDetector | None = None,
        fallback_router: RegexFallbackRouter | None = None,
        telemetry: ComplianceLogger | None = None,
    ) -> None:
        self.config = config
        self.language_detector = language_detector or LinguaLanguageDetector()
        self.fallback_router = fallback_router or RegexFallbackRouter()
        self.llm_client = llm_client or LightweightQwenIntentModel(config)
        self.telemetry = telemetry or ComplianceLogger(
            extra_context=config.compliance_log_context
        )

    def route(
        self,
        text: str,
        metadata: dict | None = None,
        request_id: str | None = None,
        offline_override: bool = False,
    ) -> RouterOutput:
        request = RoutingRequest(text=text, metadata=metadata or {}, request_id=request_id)
        return self.route_batch([request], offline_override=offline_override)[0]

    def route_batch(
        self,
        requests: Sequence[RoutingRequest | str],
        offline_override: bool = False,
    ) -> List[RouterOutput]:
        normalized = self._normalize_requests(requests)
        self._enforce_memory_budget(normalized)

        outputs: List[RouterOutput] = []
        budget_start = time.perf_counter()
        for chunk in _chunk(normalized, self.config.max_batch_size):
            elapsed = time.perf_counter() - budget_start
            if elapsed >= self.config.latency_budget_seconds:
                raise RouterTimeoutError("Routing exceeded latency budget")
            outputs.extend(self._route_chunk(chunk, offline_override))
            elapsed_after_chunk = time.perf_counter() - budget_start
            if elapsed_after_chunk >= self.config.latency_budget_seconds:
                raise RouterTimeoutError("Routing exceeded latency budget")
        return outputs

    def _route_chunk(
        self, requests: Sequence[RoutingRequest], offline_override: bool
    ) -> List[RouterOutput]:
        language_contexts = [self.language_detector.detect(req.text) for req in requests]
        predictions: List[ModelPrediction]
        try:
            if offline_override:
                raise RouterModelUnavailableError("Offline override engaged")
            predictions = self.llm_client.classify(requests, language_contexts)
        except (RouterModelUnavailableError, RouterTimeoutError) as error:
            predictions = [
                self.fallback_router.route(request, language, str(error))
                for request, language in zip(requests, language_contexts)
            ]

        outputs: List[RouterOutput] = []
        for request, prediction, language in zip(
            requests, predictions, language_contexts
        ):
            output = self._build_output(request, prediction, language)
            validate_router_output(output.as_dict())
            outputs.append(output)
            self._emit_telemetry(output, request)
        return outputs

    def _build_output(
        self,
        request: RoutingRequest,
        prediction: ModelPrediction,
        language: LanguageContext,
    ) -> RouterOutput:
        metadata = {
            **request.metadata,
            **prediction.metadata,
            "language_detector_confidence": language.confidence,
            "language_detector_source": language.source,
        }
        if request.request_id:
            metadata["request_id"] = request.request_id
        timestamp = datetime.now(timezone.utc).isoformat()
        return RouterOutput(
            intent=prediction.intent,
            confidence=prediction.confidence,
            language=prediction.language,
            reasoning=prediction.reasoning,
            timestamp=timestamp,
            router_version=self.config.router_version,
            fallback_used=prediction.fallback_used,
            metadata=metadata,
        )

    def _emit_telemetry(self, output: RouterOutput, request: RoutingRequest) -> None:
        event = {
            "intent": output.intent,
            "confidence": output.confidence,
            "language": output.language,
            "fallback_used": output.fallback_used,
            "request_id": request.request_id,
            "metadata": output.metadata,
            "timestamp": output.timestamp,
        }
        self.telemetry.log_decision(event)

    def _enforce_memory_budget(self, requests: Sequence[RoutingRequest]) -> None:
        estimated_bytes = sum(len(request.text) for request in requests) * 2
        if estimated_bytes > self.config.memory_budget_bytes:
            raise MemoryBudgetExceeded(
                "Incoming batch would exceed the configured memory budget"
            )

    def _normalize_requests(
        self, requests: Sequence[RoutingRequest | str]
    ) -> List[RoutingRequest]:
        normalized: List[RoutingRequest] = []
        for item in requests:
            if isinstance(item, RoutingRequest):
                normalized.append(item)
            elif isinstance(item, str):
                normalized.append(RoutingRequest(text=item))
            else:
                raise TypeError("Unsupported routing payload type")
        return normalized


def _chunk(sequence: Sequence[RoutingRequest], size: int) -> Iterable[List[RoutingRequest]]:
    chunk: List[RoutingRequest] = []
    for item in sequence:
        chunk.append(item)
        if len(chunk) == size:
            yield chunk
            chunk = []
    if chunk:
        yield chunk


__all__ = ["IntentRouterService"]
