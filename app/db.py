from __future__ import annotations

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    """Base declarative class for SQLAlchemy models."""


def _sanitize_passphrase(passphrase: str) -> str:
    return passphrase.replace("'", "''")


_engine: Engine | None = None
SessionLocal: sessionmaker[Session] | None = None


def _build_engine() -> Engine:
    settings = get_settings()
    engine = create_engine(
        settings.database_url,
        future=True,
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    @event.listens_for(engine, "connect")
    def _set_sqlcipher_pragma(dbapi_connection, connection_record):  # type: ignore[override]
        cursor = dbapi_connection.cursor()
        cursor.execute(f"PRAGMA key = '{_sanitize_passphrase(settings.database_key)}';")
        cursor.execute("PRAGMA cipher_page_size = 4096;")
        cursor.execute("PRAGMA cipher_memory_security = ON;")
        cursor.close()

    return engine


def init_engine(force: bool = False) -> Engine:
    global _engine, SessionLocal
    if _engine is not None and not force:
        return _engine

    engine = _build_engine()
    SessionLocal = sessionmaker(
        bind=engine,
        class_=Session,
        expire_on_commit=False,
        autoflush=False,
        future=True,
    )
    _engine = engine
    return engine


engine = init_engine()


def reload_engine() -> Engine:
    global _engine
    if _engine is not None:
        _engine.dispose()
        _engine = None
    get_settings.cache_clear()
    return init_engine(force=True)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    if SessionLocal is None:
        raise RuntimeError("Session factory is not initialized")

    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
