from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import AppSettings, MonitoringSettings, OutputValidationSettings, RateLimitSettings, SafetySettings
from main import create_app


@pytest.fixture
def base_settings(tmp_path: Path) -> AppSettings:
    logs_dir = tmp_path / "logs"
    settings = AppSettings(
        environment="test",
        log_dir=str(logs_dir),
        journald_log=str(tmp_path / "journald.log"),
        alert_log=str(tmp_path / "alerts.log"),
        monitoring=MonitoringSettings(
            memory_threshold_mb=2048,
            offline_ready_paths=[str(tmp_path)],
        ),
        safety=SafetySettings(
            financial_blocklist_enabled=True,
            consent_required=True,
            financial_blocklist=["blocked-user"],
            rate_limit=RateLimitSettings(enabled=True, max_requests=2, window_seconds=60),
            output_validation=OutputValidationSettings(enabled=True, blocked_terms=["advice", "ssn"]),
        ),
    )
    settings.ensure_directories()
    return settings


def test_financial_blocklist_blocks_user(base_settings: AppSettings) -> None:
    client = TestClient(create_app(base_settings))
    response = client.post(
        "/respond",
        json={"user_id": "blocked-user", "consent": True, "message": "hello"},
    )
    assert response.status_code == 403
    compliance_log = Path(base_settings.log_dir) / "compliance.log"
    assert compliance_log.exists()
    contents = compliance_log.read_text(encoding="utf-8")
    assert "financial_blocklist" in contents
    assert "blocked" in contents


def test_financial_blocklist_toggle_allows_user(base_settings: AppSettings) -> None:
    custom = replace(
        base_settings,
        safety=replace(base_settings.safety, financial_blocklist_enabled=False),
    )
    client = TestClient(create_app(custom))
    response = client.post(
        "/respond",
        json={"user_id": "blocked-user", "consent": True, "message": "hello"},
    )
    assert response.status_code == 200
    decisions = response.json()["guardrail_decisions"]
    financial = next(item for item in decisions if item["guard"] == "financial_blocklist")
    assert financial["decision"] == "skipped"


def test_rate_limit_blocks_when_enabled(base_settings: AppSettings) -> None:
    custom = replace(
        base_settings,
        safety=replace(
            base_settings.safety,
            rate_limit=RateLimitSettings(enabled=True, max_requests=1, window_seconds=30),
        ),
    )
    client = TestClient(create_app(custom))
    payload = {"user_id": "fast-user", "consent": True, "message": "ping"}
    first = client.post("/respond", json=payload)
    assert first.status_code == 200
    second = client.post("/respond", json=payload)
    assert second.status_code == 429


def test_output_validation_blocks_sensitive_terms(base_settings: AppSettings) -> None:
    client = TestClient(create_app(base_settings))
    response = client.post(
        "/respond",
        json={"user_id": "safe-user", "consent": True, "message": "please give advice"},
    )
    assert response.status_code == 422
    compliance_log = Path(base_settings.log_dir) / "compliance.log"
    contents = compliance_log.read_text(encoding="utf-8")
    assert "output_validation" in contents
    assert "blocked" in contents


def test_health_endpoint_reports_under_limit(base_settings: AppSettings) -> None:
    client = TestClient(create_app(base_settings))
    response = client.get("/health")
    payload = response.json()
    assert response.status_code == 200
    assert payload["under_2gb"] is True
    assert payload["offline_ready"] is True
