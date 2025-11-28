from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class InferenceRequest(BaseModel):
    user_id: str = Field(..., description="Unique identifier of the requesting user")
    consent: Optional[bool] = Field(None, description="Whether the user provided explicit consent")
    message: str = Field(..., description="Prompt to evaluate")
    channel: str = Field("api", description="Source of the request, e.g. api or worker")
    context: Dict[str, Any] | None = Field(default=None, description="Optional metadata")


class GuardrailDecision(BaseModel):
    guard: str
    decision: str
    reason: str
    severity: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class InferenceResponse(BaseModel):
    response: str
    guardrail_decisions: List[GuardrailDecision]


__all__ = ["InferenceRequest", "InferenceResponse", "GuardrailDecision"]
