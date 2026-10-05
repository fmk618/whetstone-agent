# 会话/题目/作答/复习(P1 阶段题目生成与评分是占位,会话 CRUD 完整可用)
from __future__ import annotations

import json
from datetime import date

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from . import deps
from .deps import Database

router = APIRouter(prefix="/quiz", tags=["quiz"])


# -- 请求模型 ----------------------------------------------------------------

class SessionIn(BaseModel):
    kind: str = Field(pattern="^(quiz|interview)$")
    title: str | None = None


class QuestionsIn(BaseModel):
    layer: str = Field(pattern="^(core|resume|domain)$")
    pack: str | None = None
    counts: dict[str, int] | None = None  # {"task": 2, "knowledge": 1, ...}


class AnswerIn(BaseModel):
    answer_text: str = Field(min_length=1)


# -- 内部工具 ----------------------------------------------------------------

def _get_session(db: Database, session_id: int):
    row = db.one("SELECT * FROM sessions WHERE id=?", (session_id,))
    if row is None:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    return row


def _session_detail(db: Database, row) -> dict:
    session = dict(row)
    questions = db.query(
        "SELECT * FROM questions WHERE session_id=? ORDER BY id", (row["id"],))
    out_questions = []
    for q in questions:
        item = dict(q)
        for field in ("key_points", "provenance"):
            if item.get(field):
                try:
                    item[field] = json.loads(item[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        answers = db.query(
            "SELECT * FROM answers WHERE question_id=? ORDER BY id", (q["id"],))
        a_out = []
        for a in answers:
            a_item = dict(a)
            if a_item.get("dim_scores"):
                try:
                    a_item["dim_scores"] = json.loads(a_item["dim_scores"])
                except (json.JSONDecodeError, TypeError):
                    pass
            a_out.append(a_item)
        item["answers"] = a_out
        out_questions.append(item)
    session["questions"] = out_questions
    return session


# -- 会话 CRUD ----------------------------------------------------------------

@router.post("/sessions", status_code=201)
def create_session(body: SessionIn) -> dict:
    db = deps.get_db()
    cur = db.exec("INSERT INTO sessions (kind, title) VALUES (?, ?)",
                  (body.kind, body.title))
    row = db.one("SELECT * FROM sessions WHERE id=?", (cur.lastrowid,))
    return dict(row)


@router.get("/sessions")
def list_sessions() -> list[dict]:
    db = deps.get_db()
    rows = db.query(
        """SELECT s.*, COUNT(q.id) AS n_questions
           FROM sessions s LEFT JOIN questions q ON q.session_id = s.id
           GROUP BY s.id ORDER BY s.id DESC""")
    return [dict(r) for r in rows]


@router.get("/sessions/{session_id}")
def get_session(session_id: int) -> dict:
    db = deps.get_db()
    row = _get_session(db, session_id)
    return _session_detail(db, row)


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int) -> dict:
    db = deps.get_db()
    _get_session(db, session_id)
    # 逐级删(先删引用方;SQLite 级联虽开,显式删更稳)
    db.exec("DELETE FROM review_queue WHERE question_id IN "
            "(SELECT id FROM questions WHERE session_id=?)", (session_id,))
    db.exec("DELETE FROM answers WHERE session_id=?", (session_id,))
    db.exec("DELETE FROM questions WHERE session_id=?", (session_id,))
    db.exec("DELETE FROM sessions WHERE id=?", (session_id,))
    return {"deleted": session_id}


@router.get("/sessions/{session_id}/export")
def export_session(session_id: int) -> Response:
    db = deps.get_db()
    row = _get_session(db, session_id)
    detail = _session_detail(db, row)
    payload = json.dumps(detail, ensure_ascii=False, indent=2)
    filename = f"session_{session_id}.json"
    return Response(
        content=payload,
        media_type="application/json; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# -- 题目生成 / 作答(P1 占位) -----------------------------------------------

@router.post("/sessions/{session_id}/questions", status_code=501)
def create_questions(session_id: int, body: QuestionsIn) -> dict:
    db = deps.get_db()
    _get_session(db, session_id)
    # 参数已通过 QuestionsIn 校验;generator 接入后替换
    return {"detail": "generator 未接入(P1)"}


@router.post("/questions/{question_id}/answer", status_code=501)
def submit_answer(question_id: int, body: AnswerIn) -> dict:
    db = deps.get_db()
    if db.one("SELECT id FROM questions WHERE id=?", (question_id,)) is None:
        raise HTTPException(status_code=404, detail=f"题目不存在: {question_id}")
    return {"detail": "evaluator 未接入(P1)"}


# -- 复习 -------------------------------------------------------------------

@router.get("/review/today")
def review_today() -> list[dict]:
    db = deps.get_db()
    today = date.today().isoformat()
    rows = db.query(
        """SELECT rq.id AS review_id, rq.competency, rq.due_on, rq.done,
                  q.id AS question_id, q.session_id, q.layer, q.pack,
                  q.difficulty, q.question, q.reference_answer,
                  q.key_points, q.provenance
           FROM review_queue rq JOIN questions q ON q.id = rq.question_id
           WHERE rq.due_on <= ? AND rq.done = 0
           ORDER BY rq.due_on, rq.id""", (today,))
    out = []
    for r in rows:
        item = dict(r)
        for field in ("key_points", "provenance"):
            if item.get(field):
                try:
                    item[field] = json.loads(item[field])
                except (json.JSONDecodeError, TypeError):
                    pass
        out.append(item)
    return out
