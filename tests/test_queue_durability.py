from __future__ import annotations

import pytest

from app import db
from app.db import Base
from app.models import MessageStatus, User
from app.queue import MAX_PAYLOAD_BYTES, QueueStoreFactory


def test_queue_persists_across_engine_reloads():
    session_factory = db.SessionLocal
    assert session_factory is not None
    session = session_factory()
    user = User(email="queue-user@example.com")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()

    factory = QueueStoreFactory()
    repo = factory.create()
    message = repo.enqueue(user_id=user_id, payload="hello world")
    assert message.status == MessageStatus.pending

    db.reload_engine()
    Base.metadata.create_all(bind=db.engine)

    reloaded_repo = QueueStoreFactory().create()
    pending = reloaded_repo.list_pending()
    assert any(item.id == message.id for item in pending)


def test_queue_payload_limit_enforced():
    session_factory = db.SessionLocal
    assert session_factory is not None
    session = session_factory()
    user = User(email="queue-payload@example.com")
    session.add(user)
    session.commit()
    user_id = user.id
    session.close()

    repo = QueueStoreFactory().create()
    oversized_payload = "x" * (MAX_PAYLOAD_BYTES + 1)
    with pytest.raises(ValueError):
        repo.enqueue(user_id=user_id, payload=oversized_payload)
