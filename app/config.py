from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from urllib.parse import quote_plus

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    database_name: str = Field(
        default="app.db",
        validation_alias=AliasChoices("APP_DB_NAME", "DB_NAME"),
    )
    database_dir: str = Field(
        default="data",
        validation_alias=AliasChoices("APP_DB_DIR", "DB_DIR"),
    )
    database_key: str = Field(
        validation_alias=AliasChoices("APP_DB_ENCRYPTION_KEY", "DB_ENCRYPTION_KEY"),
    )
    database_cipher: str = Field(
        default="aes-256-gcm",
        validation_alias=AliasChoices("APP_DB_CIPHER", "DB_CIPHER"),
    )
    database_kdf_iter: int = Field(
        default=256000,
        validation_alias=AliasChoices("APP_DB_KDF_ITER", "DB_KDF_ITER"),
    )
    retention_inactivity_days: int = Field(
        default=88,
        validation_alias=AliasChoices("APP_RETENTION_INACTIVITY_DAYS", "RETENTION_INACTIVITY_DAYS"),
    )
    retention_notice_hours: int = Field(
        default=48,
        validation_alias=AliasChoices("APP_RETENTION_NOTICE_HOURS", "RETENTION_NOTICE_HOURS"),
    )

    def _ensure_data_dir(self) -> Path:
        path = Path(self.database_dir).expanduser().resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def database_path(self) -> Path:
        return self._ensure_data_dir() / self.database_name

    @property
    def database_url(self) -> str:
        path = str(self.database_path)
        cipher = quote_plus(self.database_cipher)
        return (
            f"sqlite+pysqlcipher:///{path}"
            f"?cipher={cipher}&kdf_iter={self.database_kdf_iter}"
        )


def _default_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance."""

    return _default_settings()
