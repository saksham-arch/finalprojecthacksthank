from __future__ import annotations

import os

from fastapi import FastAPI

from app.compliance import ComplianceLogger
from app.config import AppSettings, load_settings
from app.generator import DeterministicResponder
from app.models import InferenceRequest
from app.monitoring import JournaldHook, collect_health_data
from app.safety import SafetySuite


def create_app(settings: AppSettings | None = None) -> FastAPI:
    settings = settings or load_settings()
    compliance_logger = ComplianceLogger(settings.log_dir, settings.alert_log)
    safety_suite = SafetySuite(settings, compliance_logger)
    responder = DeterministicResponder()
    journald_hook = JournaldHook(settings.journald_log)

    app = FastAPI(title="Safety Deployment API", version="1.0.0")
    compliance_logger.log_event("api boot", metadata={"environment": settings.environment})

    @app.post("/respond")
    async def respond(payload: InferenceRequest) -> dict:
        guardrail_decisions = safety_suite.evaluate_request(payload)
        response_text = responder.generate(payload.message)
        guardrail_decisions += safety_suite.validate_response(payload.user_id, response_text)
        return {
            "response": response_text,
            "guardrail_decisions": [decision.to_dict() for decision in guardrail_decisions],
        }

    @app.get("/health")
    async def health() -> dict:
        return collect_health_data(settings, journald_hook)

    return app


app = create_app()


if __name__ == "__main__":  # pragma: no cover - manual execution helper
    port = int(os.environ.get("API_PORT", "8080"))
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=port)
