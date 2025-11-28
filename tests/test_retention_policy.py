from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app import db
from app.models import ComplianceEvent, ComplianceLog, User
from app.retention import RetentionService


def test_retention_notices_and_purge():
    session_factory = db.SessionLocal
    assert session_factory is not None
    session = session_factory()

    inactive_user = User(email="inactive@example.com")
    active_user = User(email="active@example.com")
    session.add_all([inactive_user, active_user])
    session.commit()

    now = datetime.now(timezone.utc)
    cutoff_past = now - timedelta(days=90)
    inactive_user.last_active_at = cutoff_past
    active_user.last_active_at = now - timedelta(days=10)
    session.commit()
    session.close()

    service = RetentionService(session_factory=session_factory, inactivity_days=88, notice_hours=48)
    first_run = service.run_cycle(reference_time=now)
    assert first_run.flagged == 1
    assert first_run.purged == 0

    session = session_factory()
    refreshed = session.get(User, inactive_user.id)
    assert refreshed is not None
    assert refreshed.deletion_notice_sent_at is not None

    logs = session.query(ComplianceLog).filter(ComplianceLog.user_id == inactive_user.id).all()
    event_types = {log.event_type for log in logs}
    assert ComplianceEvent.deletion_notice in event_types
    assert ComplianceEvent.retention_flag in event_types
    session.close()

    second_run = service.run_cycle(reference_time=now + timedelta(hours=50))
    assert second_run.purged == 1

    session = session_factory()
    purged_user = session.get(User, inactive_user.id)
    assert purged_user is not None
    assert purged_user.purged_at is not None
    assert purged_user.is_active is False
    assert purged_user.email.startswith("purged+")

    completion_logs = (
        session.query(ComplianceLog)
        .filter(ComplianceLog.user_id == inactive_user.id, ComplianceLog.event_type == ComplianceEvent.deletion_completed)
        .all()
    )
    assert completion_logs, "Deletion completion log not created"

    still_present = session.get(User, active_user.id)
    assert still_present is not None
    assert still_present.deletion_notice_sent_at is None
    session.close()
