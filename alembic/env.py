from __future__ import annotations

import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool

from app import db  # ensures models are imported
from app.config import get_settings
from app import models  # noqa: F401  # needed for metadata discovery

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

settings = get_settings()
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = db.Base.metadata


def run_migrations_offline() -> None:
    url = settings.database_url
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = db.reload_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            version_table_schema=None,
            render_as_batch=True,
            dialect_name="sqlite",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
