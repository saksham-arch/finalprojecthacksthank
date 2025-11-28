from __future__ import annotations

import sqlite3

import pytest
from pysqlcipher3 import dbapi2 as sqlcipher

from app import db
from app.config import get_settings
from app.models import User


def test_database_requires_encryption_key():
    session_factory = db.SessionLocal
    assert session_factory is not None
    with session_factory() as session:
        session.add(User(email="alice@example.com"))
        session.commit()

    settings = get_settings()

    with sqlite3.connect(settings.database_path) as conn:
        with pytest.raises(sqlite3.DatabaseError):
            conn.execute("SELECT * FROM users").fetchall()

    cipher_conn = sqlcipher.connect(str(settings.database_path))
    cursor = cipher_conn.cursor()
    cursor.execute("PRAGMA key = 'wrong-secret';")
    with pytest.raises(sqlcipher.DatabaseError):
        cursor.execute("SELECT * FROM users").fetchall()

    cursor.close()
    cipher_conn.close()
