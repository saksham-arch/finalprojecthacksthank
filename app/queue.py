from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from . import db
from .models import MessageQueue, MessageStatus

MAX_PAYLOAD_BYTES = 5_120


def _ensure_queue_table(engine: Engine) -> None:
    MessageQueue.__table__.create(bind=engine, checkfirst=True)


@dataclass
class QueueItem:
    id: str
    user_id: str
    payload: str
    retries: int
    status: MessageStatus


class QueueRepository:
    def __init__(self, session_factory: sessionmaker[Session]):
        self._session_factory = session_factory

    def enqueue(self, user_id: str, payload: str, max_retries: int = 5) -> QueueItem:
        self._validate_payload(payload)
        with self._session_factory() as session:
            item = MessageQueue(user_id=user_id, payload=payload, max_retries=max_retries)
            session.add(item)
            session.commit()
            session.refresh(item)
            return QueueItem(
                id=item.id,
                user_id=item.user_id,
                payload=item.payload,
                retries=item.retries,
                status=item.status,
            )

    def list_pending(self, limit: int = 100) -> List[QueueItem]:
        with self._session_factory() as session:
            rows: Iterable[MessageQueue] = (
                session.query(MessageQueue)
                .filter(MessageQueue.status == MessageStatus.pending)
                .order_by(MessageQueue.created_at.asc())
                .limit(limit)
                .all()
            )
        return [self._to_item(row) for row in rows]

    def mark_processed(self, message_id: str, status: MessageStatus) -> None:
        with self._session_factory() as session:
            row: Optional[MessageQueue] = session.get(MessageQueue, message_id)
            if not row:
                return
            row.status = status
            if status == MessageStatus.failed:
                row.retries += 1
            session.commit()

    def _to_item(self, row: MessageQueue) -> QueueItem:
        return QueueItem(
            id=row.id,
            user_id=row.user_id,
            payload=row.payload,
            retries=row.retries,
            status=row.status,
        )

    @staticmethod
    def _validate_payload(payload: str) -> None:
        if len(payload.encode("utf-8")) > MAX_PAYLOAD_BYTES:
            raise ValueError("Payload exceeds durable storage allowance")


class QueueStoreFactory:
    """Factory that guarantees queue durability across process restarts."""

    def __init__(self, engine: Engine | None = None, session_factory: sessionmaker[Session] | None = None):
        self._engine = engine or db.engine
        self._session_factory = session_factory or db.SessionLocal
        if self._session_factory is None:
            raise RuntimeError("Session factory is not initialized")
        _ensure_queue_table(self._engine)

    def create(self) -> QueueRepository:
        return QueueRepository(self._session_factory)
