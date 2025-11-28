from __future__ import annotations

import re
from typing import Any, Dict

from .exceptions import SchemaValidationError

ROUTER_OUTPUT_SCHEMA: Dict[str, Any] = {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "urn:intent-router:router-output",
    "type": "object",
    "required": [
        "intent",
        "confidence",
        "language",
        "reasoning",
        "timestamp",
        "router_version",
        "fallback_used",
        "metadata",
    ],
    "properties": {
        "intent": {"type": "string", "minLength": 3},
        "confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "language": {"type": "string", "pattern": "^[a-z]{2}$"},
        "reasoning": {"type": "string", "minLength": 1},
        "timestamp": {"type": "string", "format": "date-time"},
        "router_version": {"type": "string", "minLength": 3},
        "fallback_used": {"type": "boolean"},
        "metadata": {"type": "object"},
    },
    "additionalProperties": True,
}


_LANGUAGE_PATTERN = re.compile(r"^[a-z]{2}$")


def validate_router_output(payload: Dict[str, Any]) -> None:
    """Validate a router response against the JSON schema without extra deps."""

    for field in ROUTER_OUTPUT_SCHEMA["required"]:
        if field not in payload:
            raise SchemaValidationError(f"Router output missing required field '{field}'")

    intent = payload["intent"]
    if not isinstance(intent, str) or len(intent.strip()) < 3:
        raise SchemaValidationError("intent must be a non-empty string")

    confidence = payload["confidence"]
    if not isinstance(confidence, (int, float)):
        raise SchemaValidationError("confidence must be numeric")
    if confidence < 0 or confidence > 1:
        raise SchemaValidationError("confidence must be between 0 and 1")

    language = payload["language"]
    if not isinstance(language, str) or not _LANGUAGE_PATTERN.match(language):
        raise SchemaValidationError("language must be a valid ISO-639-1 code")

    reasoning = payload["reasoning"]
    if not isinstance(reasoning, str) or not reasoning.strip():
        raise SchemaValidationError("reasoning must be supplied")

    timestamp = payload["timestamp"]
    if not isinstance(timestamp, str) or "T" not in timestamp:
        raise SchemaValidationError("timestamp must be ISO-8601 formatted")

    router_version = payload["router_version"]
    if not isinstance(router_version, str) or len(router_version.strip()) < 3:
        raise SchemaValidationError("router_version must describe the deployed model")

    fallback_used = payload["fallback_used"]
    if not isinstance(fallback_used, bool):
        raise SchemaValidationError("fallback_used must be boolean")

    metadata = payload["metadata"]
    if not isinstance(metadata, dict):
        raise SchemaValidationError("metadata must be an object")
