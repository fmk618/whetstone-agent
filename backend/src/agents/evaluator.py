# 评分智能体(方案 7.5/7.8):对照参考答案按维度打分 + 复习排期
from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from ..llm.base import ChatMessage
from ..llm.structured import structured_output
from .generator import Question

if TYPE_CHECKING:
    from ..llm.router import Router

_ROLE = "evaluate"


class Evaluation(BaseModel):
    """一次作答的评分结果。score 0-100;dim_scores 键为评分维度名。"""

    score: int = Field(ge=0, le=100)
    dim_scores: dict[str, int] = {}   # {"结构清晰": 24, ...}
    feedback: str
    missed_points: list[str] = []


class _EvalContainer(BaseModel):
    """LLM 结构化输出容器。"""

    evaluation: Evaluation


EVALUATE_SCHEMA = {
    "type": "object",
    "properties": {"evaluation": {
        "type": "object",
        "properties": {
            "score": {"type": "integer"},
            "dim_scores": {"type": "object"},
            "feedback": {"type": "string"},
            "missed_points": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["score", "dim_scores", "feedback", "missed_points"],
    }},
    "required": ["evaluation"],
}

EVAL_SYSTEM_PROMPT = """你是面试评分器。对照参考答案与关键点,按给定评分维度给候选人的回答打分。
规则:
1. score 为 0-100 总分;各维度分按维度权重折算后加权求和,权重来自题目 rubric。
2. key_points 里未在回答中出现的关键点,逐条写进 missed_points。
3. feedback 用中文,先说做得好的 1-2 点,再说最该改进的 1-2 点,提到具体内容不写空话。
4. 不因"没答全"而大幅扣分——按覆盖率和质量给分;回答与题目无关时给 0 分。
只输出一个符合给定 JSON Schema 的 JSON 对象,不要任何多余文字。"""


def build_eval_prompt(question: Question, answer_text: str,
                      rubric_dims: list[dict] | list[str]) -> str:
    """组装评分 prompt:题目 + 关键点 + 参考答案 + 维度权重 + 候选人回答。"""
    dims = []
    for d in rubric_dims:
        if isinstance(d, dict):
            dims.append(f"- {d.get('name')}(满分 {d.get('weight', '?')})")
        else:
            dims.append(f"- {d}")
    return (
        f"题目:{question.question}\n"
        f"参考答案:{question.reference_answer}\n"
        f"关键点:{'; '.join(question.key_points) if question.key_points else '(无)'}\n"
        f"评分维度:\n" + "\n".join(dims) + "\n\n"
        f"候选人回答:\n{answer_text}"
    )


async def evaluate_answer(role_router: "Router", question: Question,
                          answer_text: str, rubric_dims: list[dict] | list[str],
                          *, model: str | None = None) -> Evaluation:
    """对一次作答评分(方案 7.5)。发给云端前由调用方完成知情确认。"""
    prompt = build_eval_prompt(question, answer_text, rubric_dims)
    messages = [
        ChatMessage(role="system", content=EVAL_SYSTEM_PROMPT),
        ChatMessage(role="user", content=prompt),
    ]
    result = await structured_output(role_router, _ROLE, messages,
                                     _EvalContainer, EVALUATE_SCHEMA)
    return result.evaluation


def schedule_review(score: int, competency: str) -> list[int]:
    """按得分返回间隔复习的到期天数(方案 7.8)。

    <60 分 → 1/3/7 天;60-79 分 → 3/7 天;>=80 分 → 7 天。
    只算不写;写 review_queue 由 API 层调用。
    """
    if score < 60:
        return [1, 3, 7]
    if score < 80:
        return [3, 7]
    return [7]
