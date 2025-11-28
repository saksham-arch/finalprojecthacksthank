from __future__ import annotations

import pytest

from app import db
from app.config import get_settings
from app.db import Base


@pytest.fixture(autouse=True)
def _configure_database(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_ENCRYPTION_KEY", "unit-test-secret")
    monkeypatch.setenv("DB_DIR", str(tmp_path))
    monkeypatch.setenv("DB_NAME", "unittest.sqlite")
    monkeypatch.setenv("DB_CIPHER", "aes-256-gcm")
    monkeypatch.setenv("DB_KDF_ITER", "256000")

    get_settings.cache_clear()
    db.reload_engine()

    Base.metadata.drop_all(bind=db.engine)
    Base.metadata.create_all(bind=db.engine)

    yield

    Base.metadata.drop_all(bind=db.engine)
