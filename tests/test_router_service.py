from __future__ import annotations

from pathlib import Path

import pytest

from intent_router import IntentRouterConfig, IntentRouterService
from intent_router.exceptions import RouterModelUnavailableError, SchemaValidationError
from intent_router.types import ModelPrediction
from intent_router.telemetry import ComplianceLogger


class UnavailableLLM:
    def classify(self, requests, languages):
        raise RouterModelUnavailableError("offline weights unavailable")


class InvalidSchemaLLM:
    def classify(self, requests, languages):
        return [
            ModelPrediction(
                intent="bad_intent",
                confidence=1.5,
                reasoning="confidence outside schema",
                language=languages[0].language_code,
            )
        ]


@pytest.fixture()
def weights_dir(tmp_path: Path) -> Path:
    path = tmp_path / "qwen-30b"
    path.mkdir()
    return path


def test_multilingual_intents_are_classified(weights_dir: Path) -> None:
    telemetry_sink = []
    service = IntentRouterService(
        IntentRouterConfig(model_path=weights_dir),
        telemetry=ComplianceLogger(sink=telemetry_sink),
    )

    spanish_result = service.route("Necesito ayuda con mi factura")
    english_result = service.route("Please reset my password immediately")

    assert spanish_result.intent == "billing_support"
    assert spanish_result.language == "es"
    assert not spanish_result.fallback_used

    assert english_result.intent == "account_security"
    assert english_result.language == "en"
    assert english_result.metadata["classification_labels"]

    assert len(telemetry_sink) == 2
    assert telemetry_sink[0]["intent"] == "billing_support"


def test_schema_validation_failure_blocks_response(weights_dir: Path) -> None:
    service = IntentRouterService(
        IntentRouterConfig(model_path=weights_dir),
        llm_client=InvalidSchemaLLM(),
    )

    with pytest.raises(SchemaValidationError):
        service.route("hello there")


def test_offline_fallback_takeover(weights_dir: Path) -> None:
    telemetry_sink = []
    service = IntentRouterService(
        IntentRouterConfig(model_path=weights_dir),
        llm_client=UnavailableLLM(),
        telemetry=ComplianceLogger(sink=telemetry_sink),
    )

    result = service.route("I need pricing details for enterprise tier")

    assert result.fallback_used is True
    assert result.intent == "sales_inquiry"
    assert result.metadata["fallback_rule"] == "sales"
    assert "offline weights unavailable" in result.metadata["fallback_reason"]
    assert telemetry_sink[0]["fallback_used"] is True
