# 出题/评估/能力匹配测试:全部用假 provider,不联网
import pytest

from src.agents.evaluator import Evaluation, evaluate_answer, schedule_review
from src.agents.generator import (Provenance, Question, QuestionList,
                                  dedupe, generate_questions)
from src.occupation.competency import (CompetencyItem, allocate_question_counts,
                                       build_matrix, match_resume)
from src.llm.base import ChatMessage


# ---------- 假 LLM Provider:固定返回 JSON ----------

_HARNESS_QUESTIONS = {
    "questions": [
        {"question": "讲讲你简历里提到的高并发限流方案的 QPS 口径。",
         "layer": "resume", "pack": "tech", "difficulty": 3,
         "reference_answer": "答案是:结合压测口径讲。",
         "key_points": ["提到令牌桶", "提到压测口径", "验证数据来源"],
         "provenance": {"resume_evidence": {"file": "简历.md", "section": "项目A"}},
         "follow_ups": ["QPS 怎么测的?", "为什么选令牌桶?"]},
    ]
}


class FakeProvider:
    """最小 provider:结构化输出降级链需要 capabilities + chat。"""

    id = "fake"

    def __init__(self, payload: dict, calls: list | None = None):
        self.capabilities = type("Caps", (), {"json_schema": False,
                                              "json_object": True})
        self.payload = payload
        self.calls = calls if calls is not None else []

    async def chat(self, messages, *, model, temperature=0.3, **kw):
        self.calls.append({"messages": messages, "model": model})
        import json

        return json.dumps(self.payload, ensure_ascii=False)


def test_question_normalizes_text_difficulty():
    question = Question(
        question="如何验证方案?",
        layer="resume",
        pack="tech",
        difficulty="hard",
        reference_answer="通过指标和压测验证。",
    )
    assert question.difficulty == 4


class FakeRetriever:
    """假检索:固定返回片段(personal 与 reference 各自可配)。"""

    def __init__(self, personal=None, reference=None):
        self._personal = personal or []
        self._reference = reference or []

    def search(self, collection, query, embedding, *, final_top=5, **kw):
        data = self._personal if collection == "personal" else self._reference
        from types import SimpleNamespace

        return [SimpleNamespace(text=t, file="简历.md", section="项目A")
                for t in data][:final_top]


def fake_embed_fn(texts: list[str]) -> list[list[float]]:
    """确定性假向量:文本哈希够用,不真实但要可比较。"""
    out = []
    for t in texts:
        seed = float(sum(ord(c) for c in t) % 1000) + 1.0
        out.append([seed, 1.0, 0.0])
    return out


# ---------- generate_questions ----------

@pytest.mark.asyncio
async def test_generate_questions_with_fake_provider():
    """有检索片段时产出题目,competency 回填,provenance 带来源。"""
    provider = FakeProvider(_HARNESS_QUESTIONS)
    router = provider  # structured_output 直接用 provider duck-type
    retriever = FakeRetriever(personal=["做了限流组件"], reference=["令牌桶原理"])
    matrix = [(CompetencyItem(name="系统设计", weight=0.2), "A")]
    counts = {"系统设计": 2}

    qs = await generate_questions(router, retriever, fake_embed_fn, matrix,
                                  claims=[], pack_id="tech",
                                  counts=counts, layer="resume")
    assert len(qs) == 1
    q = qs[0]
    assert isinstance(q, Question)
    assert q.competency == "系统设计"
    assert q.provenance.resume_evidence == {"file": "简历.md", "section": "项目A"}
    assert len(q.follow_ups) == 2
    assert provider.calls and provider.calls[0]["model"] == "generate"


@pytest.mark.asyncio
async def test_generate_questions_skips_when_no_snippets():
    """检索片段为空的能力项被跳过,不硬生题。"""
    provider = FakeProvider(_HARNESS_QUESTIONS)
    router = provider  # structured_output 直接用 provider duck-type
    retriever = FakeRetriever(personal=[], reference=[])
    matrix = [(CompetencyItem(name="数据库", weight=0.1), "C")]
    counts = {"数据库": 1}

    qs = await generate_questions(router, retriever, fake_embed_fn, matrix,
                                  claims=[], pack_id="tech",
                                  counts=counts, layer="domain")
    assert qs == []
    assert provider.calls == []


# ---------- dedupe ----------

def test_dedupe_drops_high_similarity():
    """与已有题几乎相同的向量被丢弃;不同向量放行,新题进入池子。"""
    q_dup = Question(question="已存在的题", layer="core", pack="_core",
                     difficulty=1, reference_answer="r")
    q_new = Question(question="崭新题目", layer="core", pack="_core",
                     difficulty=1, reference_answer="r")
    existing = {"已存在的题": [1.0, 0.0, 0.0]}
    calls = {"n": 0}

    def embed_fn(texts):
        calls["n"] += 1
        # 第一个文本与已有题几乎同向(余弦≈1),其他正交
        return [[0.99, 0.1, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]][: len(texts)]

    out = dedupe([q_dup, q_new], existing, embed_fn, threshold=0.9)
    assert q_new in out and q_dup not in out


# ---------- evaluate_answer ----------

@pytest.mark.asyncio
async def test_evaluate_answer_parses_scores():
    """FakeProvider 返回的结构能被解析成 Evaluation,missed_points 逐条可读。"""
    payload = {"evaluation": {
        "score": 72,
        "dim_scores": {"技术准确性": 30, "深度与原理": 15, "场景落地": 12,
                       "表达结构": 10, "个人经历结合": 5},
        "feedback": "答到了令牌桶,但没说压测口径。",
        "missed_points": ["提到压测口径", "说明数据来源"],
    }}
    provider = FakeProvider(payload)
    router = provider  # structured_output 直接用 provider duck-type
    q = Question(question="讲讲限流方案", layer="resume", pack="tech",
                 difficulty=3, reference_answer="压测口径 5000 QPS",
                 key_points=["令牌桶", "压测口径"])
    dims = [{"name": "技术准确性", "weight": 35},
            {"name": "深度与原理", "weight": 20}]

    ev = await evaluate_answer(router, q, "用了令牌桶限流。", dims)
    assert isinstance(ev, Evaluation)
    assert ev.score == 72
    assert ev.dim_scores["技术准确性"] == 30
    assert ev.missed_points == ["提到压测口径", "说明数据来源"]
    # prompt 里应包含关键点与回答文本
    sent = provider.calls[0]["messages"]
    assert any("令牌桶" in m.content for m in sent if isinstance(m, ChatMessage))


# ---------- schedule_review ----------

def test_schedule_review_intervals():
    assert schedule_review(50, "数据库") == [1, 3, 7]
    assert schedule_review(65, "数据库") == [3, 7]
    assert schedule_review(90, "数据库") == [7]


# ---------- competency: A/B/C 分类与题量分配 ----------

def test_match_resume_categories():
    matrix = [CompetencyItem(name="系统设计", weight=0.2),
              CompetencyItem(name="数据库", weight=0.1),
              CompetencyItem(name="工程实践", weight=0.15)]
    claims = [("系统设计", "has_metric"), ("数据库", "listed_only")]
    result = match_resume(matrix, claims)
    by_name = {item.name: cat for item, cat in result}
    assert by_name["系统设计"] == "A"
    assert by_name["数据库"] == "B"
    assert by_name["工程实践"] == "C"


def test_allocate_question_counts_respects_priority():
    items = [(CompetencyItem(name="A项", weight=0.4), "B"),   # 0.4*1.0=0.4
             (CompetencyItem(name="B项", weight=0.4), "A")]   # 0.4*0.5=0.2
    counts = allocate_question_counts(items, 6)
    assert sum(counts.values()) == 6
    assert counts["A项"] > counts["B项"]
    assert set(counts) == {"A项", "B项"}


def test_build_matrix_weights_reflect_jd_hits():
    pack = [{"name": "系统设计", "weight": 0.2},
            {"name": "数据库", "weight": 0.1}]
    jd = "负责系统设计,熟悉数据库,精通系统设计实践"
    matrix = build_matrix(jd, pack)
    w = {m.name: m.weight for m in matrix}
    assert w["系统设计"] > w["数据库"]
