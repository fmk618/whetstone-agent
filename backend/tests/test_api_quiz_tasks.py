from __future__ import annotations

import asyncio

import pytest
from httpx import AsyncClient

from tests.test_api import tmp_env, client  # noqa: F401


async def _wait_terminal(client: AsyncClient, task_id: str) -> dict:
    for _ in range(50):
        response = await client.get(f"/api/quiz/question-tasks/{task_id}")
        task = response.json()
        if task["terminal"]:
            return task
        await asyncio.sleep(0)
    raise AssertionError("quiz task did not reach a terminal state")


def _session_with_claim(db) -> int:
    cur = db.exec("INSERT INTO sessions (kind, title) VALUES ('quiz', 'task')")
    db.exec(
        "INSERT INTO documents (id, filename, doc_type, sensitivity) "
        "VALUES ('doc', 'resume.md', 'resume', 'cloud_ok')"
    )
    db.exec(
        "INSERT INTO profile_claims (doc_id, competency, ctype, claim_text, strength) "
        "VALUES ('doc', '系统设计', 'skill', '做过系统设计', 'listed_only')"
    )
    return cur.lastrowid


@pytest.mark.asyncio
async def test_question_task_persists_and_reports_monotonic_progress(
    client: AsyncClient, tmp_env, monkeypatch
):
    sid = _session_with_claim(tmp_env)
    seen: list[int] = []

    async def fake_generate(session_id, body, *, progress=None):
        assert session_id == sid
        await progress(1, "第一项完成")
        await progress(0, "迟到的旧进度")
        seen.extend(row["completed"] for row in tmp_env.query(
            "SELECT completed FROM quiz_tasks"))
        return {"session_id": sid, "generated": 1, "questions": [],
                "status": "completed"}

    monkeypatch.setattr("src.api.routes_quiz._generate_questions_impl", fake_generate)
    response = await client.post(
        f"/api/quiz/sessions/{sid}/question-tasks",
        json={"layer": "core", "total": 2},
    )
    assert response.status_code == 202
    created = response.json()
    assert created["completed"] == 0
    assert created["total"] == 2
    assert created["status"] == "pending"

    task = await _wait_terminal(client, created["task_id"])
    assert task["status"] == "completed"
    assert task["completed"] == 2
    assert all(later >= earlier for earlier, later in zip(seen, seen[1:]))
    assert tmp_env.one("SELECT result_json FROM quiz_tasks WHERE id=?",
                       (created["task_id"],))["result_json"]


@pytest.mark.asyncio
async def test_question_task_returns_structured_no_evidence(client: AsyncClient, tmp_env,
                                                            monkeypatch):
    sid = _session_with_claim(tmp_env)

    async def fake_generate(session_id, body, *, progress=None):
        return {
            "session_id": session_id,
            "layer": body.layer,
            "pack": "_core",
            "generated": 0,
            "questions": [],
            "status": "no_evidence",
            "code": "no_evidence",
            "message": "请补充资料后重试",
        }

    monkeypatch.setattr("src.api.routes_quiz._generate_questions_impl", fake_generate)
    response = await client.post(
        f"/api/quiz/sessions/{sid}/question-tasks",
        json={"layer": "core", "total": 2},
    )
    task = await _wait_terminal(client, response.json()["task_id"])
    assert task["status"] == "completed"
    assert task["result"]["status"] == "no_evidence"
    assert task["result"]["code"] == "no_evidence"
    assert "补充" in task["result"]["message"]


@pytest.mark.asyncio
async def test_question_task_preserves_privacy_confirmation(client: AsyncClient, tmp_env,
                                                           monkeypatch):
    sid = _session_with_claim(tmp_env)
    tmp_env.exec("UPDATE documents SET sensitivity='local_only' WHERE id='doc'")

    class CloudRegistry:
        def is_local(self, _provider_id):
            return False

    from src.llm.router import Router

    monkeypatch.setattr("src.api.deps_agents.get_agent_router",
                        lambda: Router(CloudRegistry()))
    response = await client.post(
        f"/api/quiz/sessions/{sid}/question-tasks",
        json={"layer": "core", "total": 2},
    )
    assert response.status_code == 409
    assert "确认" in response.json()["detail"]
    assert tmp_env.query("SELECT * FROM quiz_tasks") == []
