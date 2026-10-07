# API 层测试:httpx AsyncClient(ASGITransport)+ tmp 目录隔离
# 运行:cd backend && uv run --python 3.11 pytest tests/test_api.py -x -q
from __future__ import annotations

import json
from pathlib import Path

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


# -- 夹具:tmp 目录 + 替换单例 ---------------------------------------------------

@pytest.fixture()
def tmp_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """把 data_dir 指向 tmp;重建 Database 单例与相关模块级缓存。"""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    config_dir = tmp_path / "config"
    config_dir.mkdir()
    # 最小 settings.yaml:routing/privacy 段,routing 读写与敏感检测都要用
    # generate/evaluate 供出题/评分链路读取(测试会用假 provider 替换)
    (config_dir / "settings.yaml").write_text(
        "routing:\n"
        "  embed: {provider: local-embed, model: bge-m3}\n"
        "  generate: {provider: local-llm, model: test-model}\n"
        "  evaluate: {provider: local-llm, model: test-model}\n"
        "privacy:\n"
        "  patterns:\n"
        "    phone: '(?<!\\d)1[3-9]\\d{9}(?!\\d)'\n",
        encoding="utf-8")

    import src.config as config_mod
    monkeypatch.setattr(config_mod.settings, "data_dir", data_dir)
    # config_dir 是 Settings 的 property,实例上不可赋值,改补类属性
    monkeypatch.setattr(config_mod.Settings, "config_dir",
                        property(lambda self: config_dir))

    # Database 实例固定指向 tmp 库;get_db 直接返回它
    from src.api.deps import Database
    db = Database(data_dir / "app.db")
    import src.api.deps as deps_mod
    monkeypatch.setattr(deps_mod, "_db", db, raising=False)
    monkeypatch.setattr(deps_mod, "get_db", lambda: db)

    # 向量库指向 tmp(每次新建,避免 PersistentClient 缓存串库)
    import src.api.routes_docs as docs_mod
    monkeypatch.setattr(docs_mod, "_store", None, raising=False)

    # Registry 指向 tmp 配置目录(避免测试污染真实 config/providers.yaml)
    import src.llm.registry as registry_mod
    real_get_registry = registry_mod.get_registry
    real_get_registry.cache_clear()
    reg = registry_mod.Registry(config_dir)
    monkeypatch.setattr(registry_mod, "get_registry", lambda: reg)

    # 行业包:packs_loader 用 config_dir.parent/packs,tmp 环境拷真实包过去
    packs_dst = tmp_path / "packs"
    packs_dst.mkdir()
    for src_pack in (Path(__file__).resolve().parent.parent / "packs").glob("*"):
        if src_pack.is_dir():
            import shutil
            shutil.copytree(src_pack, packs_dst / src_pack.name)

    yield db
    # monkeypatch 撤销后,清掉 lru_cache 里可能缓存的真实 Registry
    real_get_registry.cache_clear()


@pytest_asyncio.fixture()
async def client(tmp_env) -> AsyncClient:
    from src.api.main import app
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


FAKE_DIM = 8


@pytest.fixture()
def fake_embed(monkeypatch: pytest.MonkeyPatch):
    """假 embed:固定维度向量,同时记录路由是否需要确认。"""
    calls: list[list[str]] = []
    route_calls: list[tuple[str, list[str]]] = []
    embed_markers: list[list[str]] = []

    async def _embed(
        texts: list[str],
        *,
        sens_confirmed: bool = False,
        sens_markers: list[str] | None = None,
    ):
        calls.append(list(texts))
        embed_markers.append(list(sens_markers or []))
        return [[float(len(text) % FAKE_DIM + 1)] * FAKE_DIM for text in texts]

    def _route(
        role: str,
        *,
        sens_confirmed: bool = False,
        sens_markers: list[str] | None = None,
    ):
        from src.llm.router import RouteDecision
        route_calls.append((role, list(sens_markers or [])))
        return RouteDecision(provider_id="fake", model="fake-embed", is_local=True)

    import src.api.routes_docs as docs_mod
    monkeypatch.setattr(docs_mod, "get_router",
                        lambda: type("R", (), {"embed": staticmethod(_embed),
                                               "route": staticmethod(_route)})())
    return {"calls": calls, "route_calls": route_calls, "embed_markers": embed_markers}


# -- 会话 CRUD + 导出 ----------------------------------------------------------

@pytest.mark.asyncio
async def test_session_crud_and_export(client: AsyncClient):
    r = await client.post("/api/quiz/sessions",
                          json={"kind": "quiz", "title": "第一轮"})
    assert r.status_code == 201
    sid = r.json()["id"]
    assert r.json()["kind"] == "quiz"

    # 列表
    r = await client.get("/api/quiz/sessions")
    assert r.status_code == 200
    assert [s["id"] for s in r.json()] == [sid]

    # 详情(空题目)
    r = await client.get(f"/api/quiz/sessions/{sid}")
    assert r.status_code == 200
    assert r.json()["questions"] == []

    # 404
    r = await client.get("/api/quiz/sessions/999")
    assert r.status_code == 404

    # 导出:Content-Disposition + 内容与会话一致
    r = await client.get(f"/api/quiz/sessions/{sid}/export")
    assert r.status_code == 200
    assert "attachment" in r.headers["content-disposition"]
    assert f"session_{sid}.json" in r.headers["content-disposition"]
    exported = json.loads(r.content.decode("utf-8"))
    assert exported["id"] == sid and exported["title"] == "第一轮"

    # 删除 + 确认消失
    r = await client.delete(f"/api/quiz/sessions/{sid}")
    assert r.status_code == 200
    r = await client.get(f"/api/quiz/sessions/{sid}")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_session_cascade_delete(client: AsyncClient, tmp_env):
    db = tmp_env
    db.exec("INSERT INTO sessions (kind, title) VALUES ('quiz', 'x')")
    sid = db.one("SELECT id FROM sessions")["id"]
    cur = db.exec("INSERT INTO questions (session_id, question) VALUES (?, 'Q1')", (sid,))
    qid = cur.lastrowid
    db.exec("INSERT INTO answers (question_id, session_id, answer_text) VALUES (?, ?, 'A1')",
            (qid, sid))
    db.exec("INSERT INTO review_queue (competency, question_id, due_on) VALUES ('c', ?, '2020-01-01')",
            (qid,))

    r = await client.delete(f"/api/quiz/sessions/{sid}")
    assert r.status_code == 200
    for table in ("sessions", "questions", "answers", "review_queue"):
        assert db.query(f"SELECT * FROM {table}") == [], table


@pytest.mark.asyncio
async def test_question_generation_layer_validation(client: AsyncClient):
    r = await client.post("/api/quiz/sessions", json={"kind": "quiz", "title": None})
    sid = r.json()["id"]
    # 无抽取声明 → 400(提示先上传资料)
    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "core"})
    assert r.status_code == 400
    assert "上传" in r.json()["detail"]

    # 参数校验:layer 非法 → 422
    r = await client.post(f"/api/quiz/sessions/{sid}/questions",
                          json={"layer": "bogus"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_answer_missing_routing_is_400(client: AsyncClient, tmp_env):
    """routing 里没有 evaluate 角色(测试 settings.yaml 只有 embed)→ 400。"""
    db = tmp_env
    s = db.exec("INSERT INTO sessions (kind, title) VALUES ('quiz', 'r')")
    db.exec("INSERT INTO questions (session_id, question, pack) VALUES (?, 'Q', '_core')",
            (s.lastrowid,))
    qid = db.one("SELECT id FROM questions")["id"]

    r = await client.post(f"/api/quiz/questions/{qid}/answer",
                          json={"answer_text": "我的回答"})
    assert r.status_code == 400
    r = await client.post("/api/quiz/questions/999/answer",
                          json={"answer_text": "x"})
    assert r.status_code == 404

    # 复习:due_on <= 今天且 done=0
    db.exec("INSERT INTO review_queue (competency, question_id, due_on, done) "
            "VALUES ('Py', ?, '2020-01-01', 0)", (qid,))
    db.exec("INSERT INTO review_queue (competency, question_id, due_on, done) "
            "VALUES ('Future', ?, '2999-01-01', 0)", (qid,))
    db.exec("INSERT INTO review_queue (competency, question_id, due_on, done) "
            "VALUES ('Done', ?, '2020-01-01', 1)", (qid,))
    r = await client.get("/api/quiz/review/today")
    assert r.status_code == 200
    items = r.json()
    assert [i["competency"] for i in items] == ["Py"]
    assert items[0]["question_id"] == qid


# -- 文档上传 / 列表 / 删除 -----------------------------------------------------

MD_WITH_PHONE = """# 简历

联系方式:13800138000

## 项目经历

做了一个系统,效果不错。
"""


@pytest.mark.asyncio
async def test_upload_md_list_and_delete(client: AsyncClient, tmp_env, monkeypatch,
                                         fake_embed):
    r = await client.post("/api/docs/upload",
                          files={"file": ("resume.md", MD_WITH_PHONE.encode("utf-8"),
                                          "text/markdown")},
                          data={"doc_type": "resume"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["n_chunks"] >= 1
    assert body["sensitivity"] == "local_only"  # 检测到手机号
    assert body["sens_hits"].get("phone") == 1
    assert fake_embed["route_calls"][-1] == ("embed", ["phone"])
    assert fake_embed["embed_markers"][-1] == ["phone"]
    assert body["scanned"] is None
    doc_id = body["doc_id"]
    assert len(doc_id) == 64  # sha256

    # raw 文件以 doc_id 命名保存
    import src.config as config_mod
    raws = list(config_mod.settings.raw_dir.glob(f"{doc_id}.*"))
    assert len(raws) == 1 and raws[0].suffix == ".md"

    # 列表
    r = await client.get("/api/docs")
    assert r.status_code == 200
    docs = r.json()
    assert len(docs) == 1 and docs[0]["id"] == doc_id
    assert docs[0]["sens_hits"]["phone"] == 1

    # profile:暂无抽取结果
    r = await client.get(f"/api/docs/{doc_id}/profile")
    assert r.status_code == 200 and r.json() == []

    # 重复上传(同 hash 同 mtime)→ skipped
    r = await client.post("/api/docs/upload",
                          files={"file": ("resume.md", MD_WITH_PHONE.encode("utf-8"),
                                          "text/markdown")},
                          data={"doc_type": "resume"})
    assert r.json()["skipped"] is True

    # 向量确实入库(personal 集合)
    from src.api.routes_docs import get_store
    col = get_store()._col("personal")
    assert col.count() == body["n_chunks"]

    # 简历抽取后生成 profile_claims,后续出题不再卡在“未完成抽取”
    from src.ingest.profile import Claim, Competency, ExtractionResult
    from src.llm.router import RouteDecision
    import src.api.routes_docs as docs_mod

    class _Registry:
        def get(self, _provider_id):
            return object()

    class _ExtractRouter:
        registry = _Registry()

        def route(self, role, *, sens_confirmed=False, sens_markers=None):
            return RouteDecision(provider_id="fake", model="fake-extract", is_local=True)

    async def _fake_extract(provider, model, text, *, file):
        return ExtractionResult(competencies=[Competency(
            competency="系统设计",
            type="skill",
            claims=[Claim(
                text="做了一个系统,效果不错。",
                evidence_strength="listed_only",
                source={"file": file, "section": "项目经历"},
            )],
        )])

    monkeypatch.setattr(docs_mod, "get_router", lambda: _ExtractRouter())
    monkeypatch.setattr(docs_mod, "extract_profile", _fake_extract)
    r = await client.post(f"/api/docs/{doc_id}/profile/extract")
    assert r.status_code == 200
    assert r.json()["claims"] == 1
    r = await client.get(f"/api/docs/{doc_id}/profile")
    assert r.status_code == 200 and r.json()[0]["competency"] == "系统设计"

    # 删除:documents 行 + 向量 + raw 文件
    r = await client.delete(f"/api/docs/{doc_id}")
    assert r.status_code == 200
    r = await client.get(f"/api/docs/{doc_id}/profile")
    assert r.status_code == 404
    r = await client.get("/api/docs")
    assert r.json() == []
    assert col.count() == 0


@pytest.mark.asyncio
async def test_profile_provider_connection_failure_is_retryable(
        client: AsyncClient, tmp_env, monkeypatch, fake_embed):
    """上游模型断连返回安全的 502,并保留既有能力声明。"""
    r = await client.post(
        "/api/docs/upload",
        files={"file": ("resume.md", MD_WITH_PHONE.encode("utf-8"), "text/markdown")},
        data={"doc_type": "resume"},
    )
    assert r.status_code == 200
    doc_id = r.json()["doc_id"]

    tmp_env.exec(
        """INSERT INTO profile_claims
           (doc_id, competency, ctype, claim_text, strength, source_file)
           VALUES (?, '已有能力', 'skill', '保留这条声明', 'listed_only', 'resume.md')""",
        (doc_id,),
    )

    import httpx
    import openai
    from src.llm.router import RouteDecision
    import src.api.routes_docs as docs_mod

    class _Registry:
        def get(self, _provider_id):
            return object()

    class _ExtractRouter:
        registry = _Registry()

        def route(self, role, *, sens_confirmed=False, sens_markers=None):
            return RouteDecision(provider_id="qwen", model="qwen-test", is_local=False)

    async def _connection_failure(*args, **kwargs):
        raise openai.APIConnectionError(
            message="secret sk-test-key at https://qwen.example/v1/chat/completions",
            request=httpx.Request("POST", "https://qwen.example/v1/chat/completions"),
        )

    monkeypatch.setattr(docs_mod, "get_router", lambda: _ExtractRouter())
    monkeypatch.setattr(docs_mod, "extract_profile", _connection_failure)

    r = await client.post(f"/api/docs/{doc_id}/profile/extract", params={"confirm_cloud": True})
    assert r.status_code == 502
    assert r.headers["retry-after"] == "5"
    assert r.json() == {
        "detail": "云端模型连接失败，请检查 Qwen API Key、模型配置或网络后重试。",
        "code": "provider_unavailable",
        "retryable": True,
    }
    assert "sk-test-key" not in r.text
    assert "qwen.example" not in r.text
    assert tmp_env.query(
        "SELECT claim_text FROM profile_claims WHERE doc_id=?", (doc_id,)
    )[0]["claim_text"] == "保留这条声明"


@pytest.mark.asyncio
async def test_sensitive_upload_cancel_cleans_uncommitted_raw(client: AsyncClient, tmp_env,
                                                              monkeypatch):
    import src.api.routes_docs as docs_mod
    from src.llm.router import PrivacyNotConfirmed

    class _RejectRouter:
        def route(self, role, *, sens_confirmed=False, sens_markers=None):
            raise PrivacyNotConfirmed("qwen")

    monkeypatch.setattr(docs_mod, "get_router", lambda: _RejectRouter())
    r = await client.post(
        "/api/docs/upload",
        files={"file": ("resume.md", MD_WITH_PHONE.encode("utf-8"), "text/markdown")},
        data={"doc_type": "resume"},
    )
    assert r.status_code == 409
    doc_id = __import__("hashlib").sha256(MD_WITH_PHONE.encode("utf-8")).hexdigest()
    import src.config as config_mod
    assert list(config_mod.settings.raw_dir.glob(f"{doc_id}.*")) == []
    assert (await client.get("/api/docs")).json() == []

@pytest.mark.asyncio
async def test_upload_reference_goes_to_reference_collection(
        client: AsyncClient, tmp_env, fake_embed):
    md = "# 参考标准\n\n面试评分要点。"
    r = await client.post("/api/docs/upload",
                          files={"file": ("std.md", md.encode("utf-8"),
                                          "text/markdown")},
                          data={"doc_type": "reference"})
    assert r.status_code == 200
    assert r.json()["sensitivity"] == "cloud_ok"  # 无敏感命中
    from src.api.routes_docs import get_store
    assert get_store()._col("reference").count() >= 1
    assert get_store()._col("personal").count() == 0


@pytest.mark.asyncio
async def test_upload_unsupported_type_is_400(client: AsyncClient, tmp_env):
    r = await client.post("/api/docs/upload",
                          files={"file": ("x.docx", b"binary", "application/octet-stream")},
                          data={"doc_type": "notes"})
    assert r.status_code == 400


# -- 设置:providers / routing --------------------------------------------------

@pytest.mark.asyncio
async def test_providers_no_plaintext_and_presets(client: AsyncClient, tmp_env,
                                                  monkeypatch):
    monkeypatch.setenv("TEST_KEY_SET", "sk-secret-123")
    reg_mod = __import__("src.llm.registry", fromlist=["Registry"])
    reg = reg_mod.get_registry()
    reg.upsert(reg_mod.ProviderConfig(id="p1", base_url="https://api.example.com/v1",
                                      api_key_env="TEST_KEY_SET"))
    reg.upsert(reg_mod.ProviderConfig(id="p2", base_url="https://api.example.com/v2",
                                      api_key_env="TEST_KEY_UNSET"))

    r = await client.get("/api/settings/providers")
    assert r.status_code == 200
    body = r.json()
    text = json.dumps(body, ensure_ascii=False)
    assert "sk-secret-123" not in text
    by_id = {p["id"]: p for p in body["providers"]}
    assert by_id["p1"]["api_key_env"] == "已设置"
    assert by_id["p2"]["api_key_env"] == "未设置"
    assert "qwen" in body["presets"]

    # upsert + delete
    r = await client.put("/api/settings/providers",
                         json={"id": "p3", "type": "openai_compatible",
                               "base_url": "https://api.p3.com/v1",
                               "api_key_env": None, "is_local": True})
    assert r.status_code == 200
    assert "p3" in reg.list_ids()
    r = await client.delete("/api/settings/providers/p3")
    assert r.status_code == 200
    assert "p3" not in reg.list_ids()
    r = await client.delete("/api/settings/providers/p3")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_routing_read_write(client: AsyncClient, tmp_env):
    r = await client.get("/api/settings/routing")
    assert r.status_code == 200
    original = r.json()["routing"]

    new_routing = dict(original)
    new_routing["generate"] = {"provider": "ollama", "model": "llama3"}
    r = await client.put("/api/settings/routing", json={"routing": new_routing})
    assert r.status_code == 200

    # 写回后 yaml 其他段保留
    r = await client.get("/api/settings/routing")
    assert r.json()["routing"]["generate"]["provider"] == "ollama"
    import yaml
    import src.config as config_mod
    data = yaml.safe_load((config_mod.settings.config_dir / "settings.yaml")
                          .read_text(encoding="utf-8"))
    assert "phone" in data["privacy"]["patterns"]  # 其他段(routing 之外)没丢
    assert data["routing"]["generate"] == {"provider": "ollama", "model": "llama3"}


@pytest.mark.asyncio
async def test_keyring_hint(client: AsyncClient):
    r = await client.get("/api/settings/keyring-hint")
    assert r.status_code == 200
    body = r.json()
    assert "local" in body and "public" in body
