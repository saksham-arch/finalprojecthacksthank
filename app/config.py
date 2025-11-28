from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, List
import os

try:  # pragma: no cover - fallback for Python < 3.11
    import tomllib  # type: ignore[attr-defined]
except ModuleNotFoundError:  # pragma: no cover
    import tomli as tomllib  # type: ignore[no-redef]


@dataclass
class RateLimitSettings:
    enabled: bool = True
    max_requests: int = 5
    window_seconds: int = 60


@dataclass
class OutputValidationSettings:
    enabled: bool = True
    blocked_terms: List[str] = field(
        default_factory=lambda: ["advice", "ssn", "account number", "wire instructions"]
    )


@dataclass
class SafetySettings:
    financial_blocklist_enabled: bool = True
    consent_required: bool = True
    financial_blocklist: List[str] = field(default_factory=list)
    rate_limit: RateLimitSettings = field(default_factory=RateLimitSettings)
    output_validation: OutputValidationSettings = field(default_factory=OutputValidationSettings)


@dataclass
class MonitoringSettings:
    memory_threshold_mb: int = 2048
    offline_ready_paths: List[str] = field(default_factory=lambda: ["config", "systemd", "scripts"])


@dataclass
class AppSettings:
    environment: str = "production"
    log_dir: str = "logs"
    journald_log: str = "logs/journald.log"
    alert_log: str = "logs/alerts.log"
    safety: SafetySettings = field(default_factory=SafetySettings)
    monitoring: MonitoringSettings = field(default_factory=MonitoringSettings)

    def ensure_directories(self) -> None:
        Path(self.log_dir).mkdir(parents=True, exist_ok=True)
        Path(self.alert_log).parent.mkdir(parents=True, exist_ok=True)
        Path(self.journald_log).parent.mkdir(parents=True, exist_ok=True)


def _env_bool(name: str, default: bool) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError:
        return default


def _env_list(name: str, default: Iterable[str]) -> List[str]:
    value = os.environ.get(name)
    if value is None:
        return list(default)
    return [item.strip() for item in value.split(",") if item.strip()]


def _load_toml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open("rb") as handle:
        return tomllib.load(handle)


def load_settings(explicit_path: str | None = None) -> AppSettings:
    """Load settings from TOML configuration and environment variables."""

    config_path = Path(explicit_path or os.environ.get("APP_SETTINGS_FILE", "config/settings.toml"))
    data = _load_toml(config_path)
    if not data:
        fallback = Path("config/settings.example.toml")
        data = _load_toml(fallback)

    app_section = data.get("app", {})
    safety_section = data.get("safety", {})
    rate_section = safety_section.get("rate_limit", {})
    output_section = safety_section.get("output_validation", {})
    monitoring_section = data.get("monitoring", {})

    settings = AppSettings(
        environment=os.environ.get("ENVIRONMENT", app_section.get("environment", "production")),
        log_dir=os.environ.get("APP_LOG_DIR", app_section.get("log_dir", "logs")),
        journald_log=os.environ.get("JOURNALD_LOG_PATH", app_section.get("journald_log", "logs/journald.log")),
        alert_log=os.environ.get("ALERT_LOG_PATH", "logs/alerts.log"),
        safety=SafetySettings(
            financial_blocklist_enabled=_env_bool(
                "SAFETY_FINANCIAL_BLOCKLIST_ENABLED",
                safety_section.get("financial_blocklist_enabled", True),
            ),
            consent_required=_env_bool(
                "SAFETY_CONSENT_REQUIRED", safety_section.get("consent_required", True)
            ),
            financial_blocklist=_env_list(
                "FINANCIAL_BLOCKLIST", safety_section.get("financial_blocklist", [])
            ),
            rate_limit=RateLimitSettings(
                enabled=_env_bool(
                    "SAFETY_RATE_LIMIT_ENABLED", rate_section.get("enabled", True)
                ),
                max_requests=_env_int(
                    "SAFETY_RATE_LIMIT_MAX_REQUESTS", rate_section.get("max_requests", 5)
                ),
                window_seconds=_env_int(
                    "SAFETY_RATE_LIMIT_WINDOW_SECONDS", rate_section.get("window_seconds", 60)
                ),
            ),
            output_validation=OutputValidationSettings(
                enabled=_env_bool(
                    "SAFETY_OUTPUT_VALIDATION_ENABLED", output_section.get("enabled", True)
                ),
                blocked_terms=_env_list(
                    "SAFETY_BLOCKED_TERMS", output_section.get("blocked_terms", [])
                ),
            ),
        ),
        monitoring=MonitoringSettings(
            memory_threshold_mb=_env_int(
                "MONITORING_MEMORY_THRESHOLD_MB", monitoring_section.get("memory_threshold_mb", 2048)
            ),
            offline_ready_paths=_env_list(
                "MONITORING_OFFLINE_PATHS",
                monitoring_section.get(
                    "offline_ready_paths", MonitoringSettings().offline_ready_paths
                ),
            ),
        ),
    )

    settings.ensure_directories()
    return settings


__all__ = [
    "AppSettings",
    "SafetySettings",
    "RateLimitSettings",
    "OutputValidationSettings",
    "MonitoringSettings",
    "load_settings",
]
