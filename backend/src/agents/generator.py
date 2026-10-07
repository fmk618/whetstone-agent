# 出题智能体(方案 7.4):能力矩阵 → 检索取证 → 结构化生成 → 去重闸门
from __future__ import annotations

import math
from typing import Callable, Protocol

from pydantic import BaseModel, Field, field_validator

from ..llm.base import ChatMessage
from ..llm.structured import structured_output
from ..occupation.competency import CompetencyItem, MatchCategory

QuestionLayer = str  # core | resume | domain


class Provenance(BaseModel):
    """题目出处:JD 要求、简历证据、参考资料;检索不到时 reference 写"资料外知识"。"""

    jd_requirement: str | None = None
    resume_evidence: dict | None = None   # {"file": ..., "section": ...}
    reference: dict | None = None


class Question(BaseModel):
    """一道模拟面试题(方案 7.4 的题目结构)。"""

    question: str
    layer: QuestionLayer
    pack: str
    difficulty: int = Field(ge=1, le=5)
    reference_answer: str
    key_points: list[str] = []
    provenance: Provenance = Field(default_factory=Provenance)
    follow_ups: list[str] = []
    competency: str = ""  # 归属能力项,复习聚合用

    @field_validator("difficulty", mode="before")
    @classmethod
    def normalize_difficulty(cls, value):
        if isinstance(value, str):
            labels = {
                "very easy": 1,
                "easy": 2,
                "medium": 3,
                "moderate": 3,
                "hard": 4,
                "difficult": 4,
                "very hard": 5,
                "expert": 5,
            }
            normalized = value.strip().lower()
            if normalized in labels:
                return labels[normalized]
            try:
                return int(normalized)
            except ValueError:
                pass
        return value


class QuestionList(BaseModel):
    """LLM 结构化输出容器。"""

    questions: list[Question]


class RetrievedLike(Protocol):
    """HybridRetriever.search 返回的片段协议。"""

    text: str
    file: str
    section: str


# 对一个能力项检索引用的片段数上限,防止 prompt 爆炸
_MAX_SNIPPETS = 3
# 相似度阈值:与已有题超过该值视为重复,丢弃
_DEFAULT_DUP_THRESHOLD = 0.9

GENERATE_SCHEMA = {
    "type": "object",
    "properties": {"questions": {"type": "array", "items": {}}},
    "required": ["questions"],
}

GEN_SYSTEM_PROMPT = """你是资深面试官与题目设计师。依据给定资料为候选人生成模拟面试题。
硬性约束:
1. 每道题必须带 provenance,写清依据的检索片段的 file/section。
2. 不得编造候选人的经历;检索片段里没有的内容不能出现在个人化的题目里。
3. 若能力项没有任何检索片段,该题 provenance.reference 写"资料外知识"并出标准知识点题。
4. key_points 3-6 条,逐条独立可评;layer=resume 且能力项为 A 类时,给出 3-5 条追问链。
只输出一个符合给定 JSON Schema 的 JSON 对象,不要任何多余文字。"""


def _snippets_block(snippets: list[RetrievedLike]) -> str:
    lines = []
    for i, s in enumerate(snippets):
        lines.append(f"[片段{i + 1}] file={s.file} section={s.section}\n{s.text}")
    return "\n".join(lines)


def _build_prompt(competency: str, category: str, count: int, layer: str,
                  pack_id: str, snippets: list[RetrievedLike],
                  jd_requirement: str = "") -> str:
    src = _snippets_block(snippets) if snippets else "(该能力项检索无片段)"
    out_of_material = "" if snippets else 'provenance.reference 写 "资料外知识",'
    return (
        f"目标能力项:{competency}(匹配类别 {category},出 {count} 题,layer={layer},"
        f"pack={pack_id})\n"
        f"JD 要求:{jd_requirement or '(未提供)'}\n\n"
        f"检索到的资料片段:\n{src}\n\n"
        f"要求:{out_of_material}每题必须带 provenance(引用上面片段的 file/section)。"
        + ("layer=resume:请输出追问链 follow_ups 3-5 条。" if layer == "resume" else
           "layer=core 或 domain:follow_ups 可为空。")
    )


async def generate_questions(role_router, retriever, embed_fn: Callable[[list[str]], object],
                             matrix_items: list[tuple[CompetencyItem, MatchCategory]],
                             claims: list[tuple[str, str]], pack_id: str,
                             counts: dict[str, int], layer: QuestionLayer,
                             *, jd_requirement: str = "") -> list[Question]:
    """按能力项逐一生成题目(方案 7.4)。

    流程:能力名+类别 → 检索 query → embed_fn → HybridRetriever.search(personal 与
    reference 两集合)→ 取片段 → structured_output 产出 Question。
    检索片段为空的能力项标注"资料外知识"并跳过该能力项。
    """
    skip_names = {name for name, n in counts.items() if n <= 0}
    out: list[Question] = []

    for item, category in matrix_items:
        if item.name in skip_names or counts.get(item.name, 0) <= 0:
            continue
        query = f"{item.name} {category} 经历 证据 项目"
        embedding = await _as_list(embed_fn, query)
        snippets: list[RetrievedLike] = []
        for collection in ("personal", "reference"):
            try:
                snippets.extend(retriever.search(collection, query, embedding,
                                                 final_top=_MAX_SNIPPETS))
            except Exception:
                continue  # 检索失败按无片段处理
        if not snippets:
            continue  # 该能力项无片段 → 跳过(资料外知识只在已出题里标注,不硬生)
        prompt = _build_prompt(item.name, category, counts[item.name], layer,
                               pack_id, snippets, jd_requirement)
        messages = [
            ChatMessage(role="system", content=GEN_SYSTEM_PROMPT),
            ChatMessage(role="user", content=prompt),
        ]
        result = await structured_output(role_router, "generate", messages,
                                         QuestionList, GENERATE_SCHEMA)
        for q in result.questions[:counts[item.name]]:
            if not q.competency:
                q.competency = item.name
            # 无片段兜底标注(理论上上面已跳过,保险再标一次)
            if not snippets and not q.provenance.reference:
                q.provenance.reference = {"资料外知识": True}
            out.append(q)
    return out


async def _as_list(embed_fn: Callable, text: str) -> list[float]:
    """embed_fn 兼容同步/异步返回。"""
    res = embed_fn([text])
    if hasattr(res, "__await__"):
        res = await res
    return res[0]


def _supports_kwarg(fn) -> bool:
    """structured_output 是否支持 sens_confirmed(旧签名兼容)。"""
    import inspect

    try:
        return "sens_confirmed" in inspect.signature(fn).parameters
    except (TypeError, ValueError):
        return False


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def dedupe(questions: list[Question], existing_embeddings: dict[str, list[float]],
           embed_fn: Callable, *, threshold: float = _DEFAULT_DUP_THRESHOLD) -> list[Question]:
    """质量闸门:与已有题向量相似度过高则丢弃(简单余弦)。

    Args:
        questions: 待筛的题目
        existing_embeddings: {已有题文本: 向量}
        embed_fn: 接受 list[str] 返回 list[list[float]](可同步,或返回 awaitable)
        threshold: 相似度阈值,超过视为重复
    Returns:
        去重后的题目
    """
    import inspect

    new_texts = [q.question for q in questions]
    if inspect.iscoroutinefunction(embed_fn):
        # 异步场景由调用方 await;这里只支持同步 embed_fn(测试与 API 层都可满足)
        raise TypeError("dedupe 的 embed_fn 需同步;异步场景请在调用前 await 封装")
    vecs = list(embed_fn(new_texts)) if new_texts else []
    out: list[Question] = []
    pool = dict(existing_embeddings)
    for q, v in zip(questions, vecs):
        if not v:
            out.append(q)  # 向量拿不到就放行,不阻塞生成
            continue
        if any(_cosine(v, ev) >= threshold for ev in pool.values()):
            continue
        pool[q.question] = v
        out.append(q)
    return out
