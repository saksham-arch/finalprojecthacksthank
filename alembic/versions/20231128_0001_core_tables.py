"""core tables

Revision ID: 20231128_0001
Revises: 
Create Date: 2023-11-28 00:00:00.000000

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20231128_0001"
down_revision = None
branch_labels = None
depends_on = None


consent_enum = sa.Enum("granted", "denied", "revoked", name="consentstatus")
message_status_enum = sa.Enum("pending", "processing", "failed", "sent", name="messagestatus")
compliance_event_enum = sa.Enum(
    "deletion_notice", "deletion_completed", "retention_flag", name="complianceevent"
)


def upgrade() -> None:
    consent_enum.create(op.get_bind(), checkfirst=True)
    message_status_enum.create(op.get_bind(), checkfirst=True)
    compliance_event_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("consent_status", consent_enum, nullable=False, server_default="granted"),
        sa.Column("preferred_language", sa.String(length=8), nullable=False, server_default="en"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.sql.expression.true()),
        sa.Column("last_active_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("deletion_notice_sent_at", sa.DateTime(timezone=True)),
        sa.Column("purged_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    op.create_table(
        "financial_state",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("net_worth", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("consent_snapshot", consent_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "message_queue",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("payload", sa.Text(), nullable=False),
        sa.Column("retries", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_retries", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("status", message_status_enum, nullable=False, server_default="pending"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("length(payload) <= 5120", name="payload_size_limit"),
    )

    op.create_table(
        "compliance_log",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("user_id", sa.String(length=36), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("event_type", compliance_event_enum, nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("compliance_log")
    op.drop_table("message_queue")
    op.drop_table("financial_state")
    op.drop_table("users")
    compliance_event_enum.drop(op.get_bind(), checkfirst=True)
    message_status_enum.drop(op.get_bind(), checkfirst=True)
    consent_enum.drop(op.get_bind(), checkfirst=True)
