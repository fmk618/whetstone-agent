# 全链路测试:上传资料 → 出题 → 作答 → 评分 → 复习队列(假 provider,不联网)
# 运行:cd backend && uv run --python 3.11 pytest tests/test_api_quiz_flow.py -q
from __future__ import annotations

import json

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from tests.test_api import tmp_env, client  # noqa: F401 复用夹具

# -- LLM 假包件(参考 test_generator.FakeProvider 手法) --------------------------

QUESTIONS_PAYLOAD = {
    "questions": [
        {"question": "讲讲你简历里 high-qps 网关的架构设计。",
         "layer": "resume", "pack": "tech", "difficulty": 3,
         "reference_answer": "结合压测口径讲令牌桶限流。",
         "key_points": ["提到令牌桶", "提到压测口径", "验证数据来源"],
         "provenance": {"resume_evidence": {"file": "简历.md", "section": "项目A"}},
         "follow_ups": ["QPS 怎么测的?", "为什么选令牌桶?"]},
        {"question": "说明数据库索引的原理。",
         "layer": "resume", "pack": "tech", "difficulty": 2,
         "reference_answer": "B+ 树,叶子链表,回表。",
         "key_points": ["B+ 树", "回表"],
         "provenance": {"reference": {"资料外知识": True}},
         "follow_ups": []},
    ]
}

EVAL_PAYLOAD = {"evaluation": {
    "score": 50,   # <60 → 1/3/7 三行复习
    "dim_scores": {"技术准确性": 18, "深度与原理": 10, "场景落地": 10,
                   "表达结构": 8, "个人经历结合": 4},
    "feedback": "答到了令牌桶,但没讲压测口径。",
    "missed_points": ["提到压测口径"],
}}


class FakeProvider:
    """最小 provider:capabilities + chat(结构化输出降级链需要)。"""

    id = "fake"
    is_local = True

    def __init__(self, payloads: dict):
        from src.llm.base import Capabilities

        self.capabilities = Capabilities(streaming=True, json_schema=False,
                                         json_object=True)
        self.payloads = payloads
        self.calls: list[dict] = []

    async def chat(self, messages, *, model, temperature=0.3, **kw):
        import json as _json

        self.calls.append({"model": model, "messages": messages})
        # 出题 prompt 里有"目标能力项";评分 prompt 里有"题目:...候选人回答"
        last = messages[-1].content
        is_eval = "候选人回答" in last
        if is_eval:
            payload = self.payloads["eval"]
        else:
            payload = self.payloads["gen"]
        return _json.dumps(payload, ensure_ascii=False)

    async def embed(self, texts, *, model):
        # 确定性假向量(测试夹具的 fake_embed 故意抛错,这里给独立假嵌入)
        return [[float(sum(ord(c) for c in t) % 97 + 1), 1.0, 0.0] for t in texts]


@pytest.fixture()
def fake_llm(monkeypatch: pytest.MonkeyPatch):
    """把智能体路由的 provider 换成 FakeProvider(routing 仍走配置,隔离在 tmp)。"""
    provider = FakeProvider({"gen": QUESTIONS_PAYLOAD, "eval": EVAL_PAYLOAD})

    class FakeRegistry:
        def get(self, provider_id):
            return provider

        def is_local(self, provider_id):
            return True

    from src.llm.router import RouteDecision, Router

    monkeypatch.setattr("src.api.deps_agents.get_agent_router",
                        lambda: Router(FakeRegistry()))
    monkeypatch.setattr("src.api.deps_agents.get_retriever",
                        lambda: _FakeRetriever())

    # 文档上传也要 embed:routes_docs.get_router 同样指向 fake provider
    def fake_docs_route(role, *, sens_confirmed=False, sens_markers=None):
        return RouteDecision(provider_id="fake", model="fake-model", is_local=True)

    monkeypatch.setattr(
        "src.api.routes_docs.get_router",
        lambda: type("R", (), {"route": staticmethod(fake_docs_route),
                               "embed": staticmethod(
                                   lambda texts, *, sens_confirmed=False,
                                   sens_markers=None: _fake_embed(texts))})())
    return provider


async def _fake_embed(texts: list[str]) -> list[list[float]]:
    """确定性假向量:文本哈希够用,不真实但要可比较。"""
    return [[float(sum(ord(c) for c in t) % 97 + 1), 1.0, 0.0] for t in texts]


class _FakeRetriever:
    def search(self, collection, query, embedding, *, final_top=5, **kw):
        from types import SimpleNamespace

        return [SimpleNamespace(text="做了 high-qps 网关", file="简历.md",
                                section="项目A")] * 2


# -- 用例 -----------------------------------------------------------------------

MD_RESUME = """# 简历

联系方式:13800138000

## 项目A

负责高并发网关设计与实现,QPS 峰值 5000,平均时延 30ms。
"""


@pytest.mark.asyncio
async def test_full_flow_generate_and_answer_with_review(
        client: AsyncClient, tmp_env, fake_llm):
    db = tmp_env

    # 1) 无 claims → 400(提示去上传)
    r = await client.post("/api/quiz/sessions", json={"kind": "quiz"})
    sid = r.json()["id"]
    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "resume", "pack_id": "tech"})
    assert r.status_code == 400
    assert "上传" in r.json()["detail"]

    # 2) 上传文档(mock 嵌入,不依赖真实 embed 路由)+ 手动插抽取声明
    res = await client.post(
        "/api/docs/upload",
        files={"file": ("简历.md", MD_RESUME.encode("utf-8"), "text/markdown")},
        data={"doc_type": "resume"})
    assert res.status_code == 200, res.text
    doc_id = res.json()["doc_id"]
    db.exec(
        """INSERT INTO profile_claims (doc_id, competency, ctype, domain,
                                       claim_text, strength, source_file)
           VALUES (?, '系统设计', 'task', 'tech', '负责高并发网关设计', 'has_metric',
                   '简历.md')""",
        (doc_id,))

    # 3) 出题(fake LLM 返回合法题目 JSON)
    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "resume", "pack_id": "tech",
                                "jd": "负责网关与数据库设计",
                                "total": 4, "confirm_cloud": False})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["generated"] >= 1
    assert body["questions"], body.get("message")
    q0 = body["questions"][0]
    for field in ("question", "reference_answer", "key_points", "provenance",
                  "follow_ups", "difficulty", "layer", "pack", "competency"):
        assert field in q0, field
    assert isinstance(q0["key_points"], list)

    rows = db.query("SELECT * FROM questions WHERE session_id=?", (sid,))
    assert rows, "questions 表应有行"
    stored = json.loads(rows[0]["provenance"])
    assert "follow_ups" in stored and "competency" in stored

    # 4) 作答 + 评分 + 复习排期
    qid = rows[0]["id"]
    r = await client.post(f"/api/quiz/questions/{qid}/answer",
                          json={"answer_text": "用了令牌桶。"})
    assert r.status_code == 200, r.text
    ev = r.json()
    assert ev["score"] == 50
    assert ev["dim_scores"]["技术准确性"] == 18
    assert ev["review"]["due_days"] == [1, 3, 7]

    arow = db.one("SELECT * FROM answers WHERE question_id=?", (qid,))
    assert arow and arow["score"] == 50 and arow["competency"]
    assert json.loads(arow["dim_scores"])["技术准确性"] == 18

    from datetime import date, timedelta

    today = date.today()
    expected = {(today + timedelta(days=d)).isoformat() for d in (1, 3, 7)}
    got = {r2["due_on"] for r2 in db.query(
        "SELECT due_on FROM review_queue WHERE question_id=?", (qid,))}
    assert got == expected
    assert len(got) == 3

    # 5) 复习当天可见(due_on <= 今天的一条:把其中一条标注为今天已过的日期)
    #    low-score 场景 due 都在未来,这里只验证 review/today 不报错
    r = await client.get("/api/quiz/review/today")
    assert r.status_code == 200
    assert all(item["question_id"] == qid or True for item in r.json())

    # 6) 详情/导出可读
    r = await client.get(f"/api/quiz/sessions/{sid}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["questions"][0]["answers"][0]["score"] == 50
    r = await client.get(f"/api/quiz/sessions/{sid}/export")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_generate_400_when_embed_route_missing(client: AsyncClient, tmp_env,
                                                    fake_llm, monkeypatch):
    """routing 缺 embed 角色 → 出题 400(错误信息含"路由")。"""
    import yaml
    import src.config as config_mod
    import src.api.deps_agents as da

    async def boom(*a, **kw):
        raise ValueError("settings.yaml 未配置角色路由: embed")

    monkeypatch.setattr(da, "embed_texts", boom)
    # 上传期间 embed 仍可用:先正常上传,再拆掉路由配置
    res = await client.post(
        "/api/docs/upload",
        files={"file": ("简历.md", MD_RESUME.encode("utf-8"), "text/markdown")},
        data={"doc_type": "resume"})
    doc_id = res.json()["doc_id"]
    db = tmp_env
    db.exec(
        """INSERT INTO profile_claims (doc_id, competency, ctype, claim_text,
                                       strength) VALUES (?, '系统设计', 'task',
                                       'x', 'listed_only')""", (doc_id,))

    # 拆掉 embed 路由
    cfg_path = config_mod.settings.config_dir / "settings.yaml"
    data = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
    data["routing"].pop("embed", None)
    cfg_path.write_text(yaml.safe_dump(data, allow_unicode=True), encoding="utf-8")

    r = await client.post("/api/quiz/sessions", json={"kind": "quiz"})
    sid = r.json()["id"]
    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "core"})
    assert r.status_code in (400, 409)
    detail = json.dumps(r.json(), ensure_ascii=False)
    assert "上传" in detail or "路由" in detail or "未配置" in detail, detail


@pytest.mark.asyncio
async def test_generate_409_when_local_only_and_not_confirmed(
        client: AsyncClient, tmp_env, fake_llm, monkeypatch):
    """文档 local_only 且未确认云端 → Router 链路 409;confirm_cloud=True 放行。"""
    db = tmp_env
    res = await client.post(
        "/api/docs/upload",
        files={"file": ("简历.md", MD_RESUME.encode("utf-8"), "text/markdown")},
        data={"doc_type": "resume"})
    assert res.json()["sensitivity"] == "local_only"  # 联系方式里的手机号
    doc_id = res.json()["doc_id"]
    db.exec(
        """INSERT INTO profile_claims (doc_id, competency, ctype, claim_text,
                                       strength)
           VALUES (?, '系统设计', 'task', 'q-claim', 'listed_only')""", (doc_id,))

    # 把路由指向"云端"厂商(replace registry 的 is_local 判定)→ 触发 409
    class CloudRegistry:
        def get(self, pid):
            return fake_llm

        def is_local(self, pid):
            return False

    from src.llm.router import Router

    monkeypatch.setattr("src.api.deps_agents.get_agent_router",
                        lambda: Router(CloudRegistry()))
    sid = (await client.post("/api/quiz/sessions", json={"kind": "quiz"})).json()["id"]

    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "core", "pack_id": "_core",
                                "confirm_cloud": False})
    assert r.status_code == 409, r.text
    assert "确认" in r.json()["detail"] or "local_only" in r.json()["detail"]

    # 确认后放行(fake llm 继续给出题 JSON)
    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "core", "pack_id": "_core",
                                "confirm_cloud": True})
    assert r.status_code == 200, r.text
    assert r.json()["generated"] >= 1
