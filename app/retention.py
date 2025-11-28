from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session, sessionmaker

from .models import ComplianceEvent, ComplianceLog, ConsentStatus, MessageQueue, User, FinancialState


@dataclass
class RetentionResult:
    flagged: int
    purged: int


class RetentionService:
    def __init__(self, session_factory: sessionmaker[Session], inactivity_days: int = 88, notice_hours: int = 48):
        self._session_factory = session_factory
        self._inactivity_days = inactivity_days
        self._notice_hours = notice_hours

    def run_cycle(self, reference_time: datetime | None = None) -> RetentionResult:
        now = reference_time or datetime.now(timezone.utc)
        session = self._session_factory()
        try:
            flagged = self._flag_inactive_users(session, now)
            purged = self._purge_expired_noticees(session, now)
            session.commit()
            return RetentionResult(flagged=flagged, purged=purged)
        finally:
            session.close()

    def _flag_inactive_users(self, session: Session, now: datetime) -> int:
        cutoff = now - timedelta(days=self._inactivity_days)
        query = (
            session.query(User)
            .filter(User.last_active_at <= cutoff)
            .filter(User.deletion_notice_sent_at.is_(None))
            .filter(User.purged_at.is_(None))
        )
        users = query.all()
        notice_expiry = now + timedelta(hours=self._notice_hours)
        for user in users:
            user.deletion_notice_sent_at = now
            session.add(
                ComplianceLog(
                    user_id=user.id,
                    event_type=ComplianceEvent.retention_flag,
                    payload={
                        "flagged_at": now.isoformat(),
                        "reason": "88_day_inactivity",
                    },
                )
            )
            session.add(
                ComplianceLog(
                    user_id=user.id,
                    event_type=ComplianceEvent.deletion_notice,
                    payload={
                        "notice_expires_at": notice_expiry.isoformat(),
                        "reason": "88_day_inactivity",
                    },
                )
            )
        return len(users)

    def _purge_expired_noticees(self, session: Session, now: datetime) -> int:
        cutoff = now - timedelta(hours=self._notice_hours)
        query = (
            session.query(User)
            .filter(User.deletion_notice_sent_at.is_not(None))
            .filter(User.deletion_notice_sent_at <= cutoff)
            .filter(User.purged_at.is_(None))
        )
        users = query.all()
        for user in users:
            self._anonymize_user(session, user, now)
        return len(users)

    def _anonymize_user(self, session: Session, user: User, now: datetime) -> None:
        anonymized_email = f"purged+{user.id}@example.invalid"
        user.email = anonymized_email
        user.is_active = False
        user.consent_status = ConsentStatus.revoked
        user.purged_at = now

        session.query(MessageQueue).filter(MessageQueue.user_id == user.id).delete(synchronize_session=False)
        session.query(FinancialState).filter(FinancialState.user_id == user.id).delete(synchronize_session=False)

        session.add(
            ComplianceLog(
                user_id=user.id,
                event_type=ComplianceEvent.deletion_completed,
                payload={
                    "purged_at": now.isoformat(),
                    "method": "anonymized",
                },
            )
        )
