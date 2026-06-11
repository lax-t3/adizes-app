import sqlite3
import pytest
from db.schema import init_db, get_conn, DB_PATH

def test_init_db_creates_all_tables():
    init_db()
    with get_conn() as conn:
        tables = {r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()}
    assert tables == {"settings", "daily_progress", "quiz_attempts", "topic_mastery", "streak_log"}

def test_init_db_is_idempotent():
    init_db()
    init_db()  # should not raise
    with get_conn() as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
    assert count == 5

def test_get_conn_creates_data_dir(tmp_path, monkeypatch):
    nested = tmp_path / "nested" / "dir" / "test.db"
    monkeypatch.setattr("db.schema.DB_PATH", nested)
    with get_conn() as conn:
        assert conn is not None
    assert nested.exists()
