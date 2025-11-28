from __future__ import annotations

import asyncio
from fastapi import FastAPI

from . import db
from .config import get_settings
from .queue import QueueStoreFactory
from .retention import RetentionService

app = FastAPI(title="Encrypted Backend")


@app.on_event("startup")
async def startup_event() -> None:
    settings = get_settings()
    # Ensure engine/session are ready
    db.init_engine()
    QueueStoreFactory()  # ensure queue table exists

    session_factory = db.SessionLocal
    if session_factory is None:
        raise RuntimeError("Database session factory is not initialized")

    retention_service = RetentionService(
        session_factory=session_factory,
        inactivity_days=settings.retention_inactivity_days,
        notice_hours=settings.retention_notice_hours,
    )

    async def _retention_worker() -> None:
        while True:
            retention_service.run_cycle()
            await asyncio.sleep(3600)

    app.state.retention_task = asyncio.create_task(_retention_worker())


@app.on_event("shutdown")
async def shutdown_event() -> None:
    task = getattr(app.state, "retention_task", None)
    if task is not None:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@app.get("/health")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
