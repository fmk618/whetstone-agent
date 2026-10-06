# 会话/题目/作答/复习(P1 阶段题目生成与评分是占位,会话 CRUD 完整可用)
from __future__ import annotations

import json
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, Field

from . import deps, deps_agents
from .deps import Database
from .deps_agents import embed_texts, get_agent_router, get_retriever

router = APIRouter(prefix="/quiz", tags=["quiz"])

DEFAULT_PACK = "tech"   # 行业层/简历层默认包;核心层固定 _core
CORE_PACK = "_core"


# -- 请求模型 ----------------------------------------------------------------

class SessionIn(BaseModel):
    kind: str = Field(pattern="^(quiz|interview)$")
    title: str | None = None


class QuestionsIn(BaseModel):
    layer: str = Field(pattern="^(core|resume|domain)$")
    pack_id: str | None = None            # 行业包;layer=core 时固定用 _core
    pack: str | None = None               # 旧字段名兼容(pack_id 别名)
    total: int = Field(default=8, ge=1, le=30)
    jd: str | None = None                 # 岗位描述原文;domain/resume 有 JD 则据此加权
    confirm_cloud: bool = False           # 知情确认:允许 local_only 原文发给云端


class AnswerIn(BaseModel):
    answer_text: str = Field(min_length=1)
    confirm_cloud: bool = False


# -- 内部工具:智能体接入 -------------------------------------------------------

def _json_list(raw: str | None) -> list:
    if not raw:
        return []
    try:
        v = json.loads(raw)
        return v if isinstance(v, list) else []
    except json.JSONDecodeError:
        return []


def _unwrap_prov(item: dict) -> dict:
    """provenance 从 JSON 还原;follow_ups/competency 无独立列,并入 provenance 存,读时还原。"""
    prov = item.get("provenance")
    if isinstance(prov, str) and prov:
        try:
            prov = json.loads(prov)
        except json.JSONDecodeError:
            prov = None
    if isinstance(prov, dict):
        follow_ups = prov.pop("follow_ups", None)
        competency = prov.pop("competency", None)
        if follow_ups is not None:
            item.setdefault("follow_ups", follow_ups)
        if competency:
            item.setdefault("competency", competency)
        item["provenance"] = prov
    return item


def _question_out(row) -> dict:
    """单题输出结构:key_points 解 JSON,follow_ups/competency 从 provenance 还原。"""
    item = _unwrap_prov(dict(row))
    item["key_points"] = _json_list(item.get("key_points"))
    return item


def _load_claims(db: Database) -> list[dict]:
    """全部能力声明(联 documents 取 sensitivity,给敏感路由用)。"""
    return [dict(r) for r in db.query(
        """SELECT pc.*, d.sensitivity
           FROM profile_claims pc JOIN documents d ON d.id = pc.doc_id
           ORDER BY pc.id""")]


def _sens_markers(claims: list[dict]) -> list[str]:
    """任一来源文档 local_only → 本次调用含敏感原文,交 Router 触发 409 链路。"""
    if any(c.get("sensitivity") == "local_only" for c in claims):
        return ["local_only"]
    return []


def _build_matrix(layer: str, pack: dict, jd: str | None,
                  claims: list[tuple[str, str]]):
    """能力矩阵:core 用平权重;domain/resume 有 JD 则 build_matrix 加权,否则按包权重。"""
    from ..occupation.competency import CompetencyItem, build_matrix, match_resume

    comps = [c for c in (pack.get("competencies") or [])
             if isinstance(c, dict) and c.get("name")]
    if not comps:
        raise HTTPException(status_code=400,
                            detail=f"行业包缺少能力库(competencies): {pack.get('id')}")
    if layer == "core":
        equal = round(1.0 / len(comps), 3)   # 核心层平权重,不依赖 JD
        matrix = [CompetencyItem(name=c["name"], weight=equal) for c in comps]
    elif jd:
        matrix = build_matrix(jd, comps)
    else:
        matrix = [CompetencyItem.model_validate(c) for c in comps]
    return match_resume(matrix, claims)


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
        item = _question_out(q)
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


# -- 题目生成(generator 接入) --------------------------------------------------

@router.post("/sessions/{session_id}/questions")
async def create_questions(session_id: int, body: QuestionsIn) -> dict:
    from ..agents.generator import dedupe, generate_questions
    from ..occupation.competency import allocate_question_counts
    from ..packs_loader import load_pack

    db = deps.get_db()
    _get_session(db, session_id)

    claims_rows = _load_claims(db)
    if not claims_rows:
        raise HTTPException(
            status_code=400,
            detail="请先上传并完成资料抽取:到 /api/docs 上传简历/项目/笔记,"
                   "系统抽取能力声明后才能出题。")

    pack_id = CORE_PACK if body.layer == "core" else (
        body.pack_id or body.pack or DEFAULT_PACK)
    try:
        pack = load_pack(pack_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    claims_pairs = [(c["competency"], c["strength"]) for c in claims_rows]
    matrix_items = _build_matrix(body.layer, pack, body.jd, claims_pairs)
    counts = allocate_question_counts(matrix_items, body.total)

    markers = _sens_markers(claims_rows)
    rt = deps_agents.get_agent_router()

    async def _embed(texts: list[str]) -> list[list[float]]:
        # 敏感:检索 query 含 claim 原文;local_only 且路由目标为云端时
        # Router 抛 PrivacyNotConfirmed(main 统一转 409 知情确认)
        return await embed_texts(rt, texts, sens_confirmed=body.confirm_cloud,
                                 sens_markers=markers)

    questions = await generate_questions(
        deps_agents.generate_role_provider(rt, sens_confirmed=body.confirm_cloud,
                                           sens_markers=markers),
        get_retriever(), _embed, matrix_items, claims_pairs,
        pack_id, counts, body.layer, jd_requirement=body.jd or "")

    # 去重闸门:同批内 + 与本会话已有题(向量化一次并缓存;dedupe 要求同步 embed_fn)
    prev_texts = [r["question"] for r in db.query(
        "SELECT question FROM questions WHERE session_id=?", (session_id,))]
    cue_texts = [q.question for q in questions] + prev_texts
    cue_vecs = await _embed(cue_texts) if cue_texts else []
    vec_by_text = dict(zip(cue_texts, cue_vecs))
    existing = {t: vec_by_text[t] for t in prev_texts if vec_by_text.get(t)}

    def _sync_embed(texts: list[str]) -> list[list[float]]:
        return [vec_by_text.get(t) for t in texts]

    questions = dedupe(questions, existing, _sync_embed, threshold=0.9)

    saved: list[dict] = []
    for q in questions:
        provenance = q.provenance.model_dump(exclude_none=True)
        if q.follow_ups:
            provenance["follow_ups"] = q.follow_ups
        if q.competency:
            provenance["competency"] = q.competency
        cur = db.exec(
            """INSERT INTO questions (session_id, layer, pack, difficulty,
                                      question, reference_answer, key_points,
                                      provenance)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (session_id, q.layer, q.pack, q.difficulty, q.question,
             q.reference_answer, json.dumps(q.key_points, ensure_ascii=False),
             json.dumps(provenance, ensure_ascii=False)))
        saved.append(_question_out(
            db.one("SELECT * FROM questions WHERE id=?", (cur.lastrowid,))))

    out = {"session_id": session_id, "layer": body.layer, "pack": pack_id,
           "generated": len(saved), "questions": saved}
    if not saved:
        out["message"] = ("所有能力项均未检索到资料片段,未生成题目;"
                          "请确认已上传相关资料,或补充资料后重试。")
    return out


# -- 作答评分(evaluator 接入)---------------------------------------------------

@router.post("/questions/{question_id}/answer")
async def submit_answer(question_id: int, body: AnswerIn) -> dict:
    from ..agents.evaluator import evaluate_answer, schedule_review
    from ..agents.generator import Question
    from ..packs_loader import load_pack

    db = deps.get_db()
    row = db.one("SELECT * FROM questions WHERE id=?", (question_id,))
    if row is None:
        raise HTTPException(status_code=404, detail=f"题目不存在: {question_id}")

    try:
        pack = load_pack(row["pack"] or CORE_PACK)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    rubric_dims = (pack.get("rubric") or {}).get("dims") or []

    # 还原题目对象(key_points 存独立 JSON 列;follow_ups/competency 在 provenance 里)
    stored = json.loads(row["provenance"]) if row["provenance"] else {}
    q = Question(
        question=row["question"], layer=row["layer"] or "core",
        pack=row["pack"] or CORE_PACK, difficulty=row["difficulty"] or 3,
        reference_answer=row["reference_answer"] or "",
        key_points=_json_list(row["key_points"]),
        follow_ups=stored.get("follow_ups") if isinstance(stored.get("follow_ups"), list) else [],
        competency=stored.get("competency") or "",
    )

    # 敏感:题目/参考答案可能由 claim 原文生成;任一来源文档 local_only 即带标记
    markers = _sens_markers(_load_claims(db))
    rt = deps_agents.get_agent_router()
    ev = await evaluate_answer(
        deps_agents.generate_role_provider(rt, role="evaluate",
                                           sens_confirmed=body.confirm_cloud,
                                           sens_markers=markers),
        q, body.answer_text, rubric_dims)

    competency = q.competency or row["pack"] or "未分类"
    cur = db.exec(
        """INSERT INTO answers (question_id, session_id, answer_text, score,
                                dim_scores, feedback, competency)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (question_id, row["session_id"], body.answer_text, ev.score,
         json.dumps(ev.dim_scores, ensure_ascii=False), ev.feedback, competency))

    # 复习排期:分数段决定间隔;due_on = 今天 + 间隔天数
    due_days = schedule_review(ev.score, competency)
    today = date.today()
    for d in due_days:
        db.exec(
            "INSERT INTO review_queue (competency, question_id, due_on) VALUES (?, ?, ?)",
            (competency, question_id, (today + timedelta(days=d)).isoformat()))

    return {"answer_id": cur.lastrowid, "question_id": question_id,
            "score": ev.score, "dim_scores": ev.dim_scores,
            "feedback": ev.feedback, "missed_points": ev.missed_points,
            "competency": competency,
            "review": {"due_days": due_days, "done": False}}


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
        item = _question_out(r)
        out.append(item)
    return out
