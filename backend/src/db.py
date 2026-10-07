# SQLite 业务库:文档、抽取结果、题目、会话记录、作答、评分、复习(含计划修订的会话设计)
from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from .config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,               -- 文件哈希,增量更新用
  filename TEXT NOT NULL,
  doc_type TEXT NOT NULL,            -- resume|project|notes|jd|reference
  sensitivity TEXT NOT NULL,         -- local_only|cloud_ok
  sens_hits TEXT,                    -- 敏感命中 JSON {"phone": 2, ...}
  n_chunks INTEGER DEFAULT 0,
  embedded_json TEXT,                -- 绑定的嵌入模型 JSON
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS profile_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id TEXT REFERENCES documents(id) ON DELETE CASCADE,
  competency TEXT NOT NULL,
  ctype TEXT NOT NULL,               -- task|knowledge|skill|work_style
  domain TEXT,
  claim_text TEXT NOT NULL,
  strength TEXT NOT NULL,            -- has_metric|listed_only|none
  source_file TEXT, source_section TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                -- quiz|interview
  title TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  layer TEXT,                        -- core|resume|domain
  pack TEXT,
  difficulty INTEGER,
  question TEXT NOT NULL,
  reference_answer TEXT,
  key_points TEXT,                   -- JSON 列表
  provenance TEXT,                   -- JSON:jd_requirement/resume_evidence/reference
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  score INTEGER,                     -- 0-100
  dim_scores TEXT,                   -- JSON 各维度分
  feedback TEXT,
  competency TEXT,                   -- 复习按能力项聚合
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS review_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competency TEXT NOT NULL,
  question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
  due_on TEXT NOT NULL,              -- 1/3/7 天间隔(方案 7.8)
  done INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS quiz_tasks (
  id TEXT PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|running|completed|failed
  completed INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  result_json TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_quiz_tasks_session ON quiz_tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_answers_q ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_claims_doc ON profile_claims(doc_id);
"""


def connect(db_path: Path | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or settings.db_path, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys=ON")
    conn.row_factory = sqlite3.Row
    return conn


class Database:
    """线程安全封装;FastAPI 路由通过 get_db 依赖注入。"""

    def __init__(self, path: Path | None = None):
        self._conn = connect(path)
        self._lock = threading.Lock()
        with self._conn:
            self._conn.executescript(_SCHEMA)

    def exec(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        with self._lock, self._conn:
            return self._conn.execute(sql, params)

    def query(self, sql: str, params: tuple = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self._conn.execute(sql, params).fetchall()

    def one(self, sql: str, params: tuple = ()) -> sqlite3.Row | None:
        with self._lock:
            return self._conn.execute(sql, params).fetchone()


_db: Database | None = None


def get_db() -> Database:
    global _db
    if _db is None:
        _db = Database()
    return _db
