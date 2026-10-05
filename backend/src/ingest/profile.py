# 敏感信息检测 + 简历/项目 LLM 抽取(方案 7.1;隐私按计划修订:检测+知情确认)
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field

from ..config import settings
from ..llm.base import ChatMessage
from ..llm.structured import structured_output

Sensitivity = Literal["local_only", "cloud_ok"]

# 证据类型通用,不绑定技术岗(方案 7.1 表)
EvidenceType = Literal["task", "knowledge", "skill", "work_style"]
ClaimStrength = Literal["has_metric", "listed_only", "none"]


class Claim(BaseModel):
    text: str
    evidence_strength: ClaimStrength
    source: dict = Field(default_factory=dict)  # {"file": ..., "section": ...}


class Competency(BaseModel):
    competency: str
    type: EvidenceType
    domain: str = "general"
    claims: list[Claim] = []


class ExtractionResult(BaseModel):
    competencies: list[Competency]


def detect_sensitivities(text: str) -> dict[str, int]:
    """正则扫描手机号/邮箱/身份证号/银行卡号,返回各类命中数。"""
    pats = (settings.yaml_data.get("privacy") or {}).get("patterns") or {}
    hits: dict[str, int] = {}
    for name, pat in pats.items():
        try:
            hits[name] = len(re.findall(pat, text))
        except re.error:
            continue
    return {k: v for k, v in hits.items() if v > 0}


def default_sensitivity(hits: dict[str, int]) -> Sensitivity:
    return "local_only" if hits else "cloud_ok"


EXTRACT_PROMPT = """你是资料整理助手。从下面这份中文简历/项目文档中抽取“能力 + 声明 + 证据”结构。
要求:
- 能力项通用,不限定技术岗(如客户需求分析、预算编制、教学设计、系统设计)。
- 每条 claim 是原文的一道陈述,标注 evidence_strength: has_metric(带量化指标)/ listed_only(仅罗列)/ none。
- 不要编造文档里没有的内容。
只输出 JSON,格式:
{"competencies": [{"competency": "...", "type": "task|knowledge|skill|work_style",
 "domain": "...", "claims": [{"text": "...", "evidence_strength": "...", "source": {"file": "...", "section": "..."}}]}]}"""


async def extract_profile(provider, model: str, text: str, *, file: str) -> ExtractionResult:
    """简历/项目做一次 LLM 抽取(方案 7.1)。发给云端前由调用方完成知情确认。"""
    messages = [
        ChatMessage(role="system", content=EXTRACT_PROMPT),
        ChatMessage(role="user", content=f"文件: {file}\n\n{text[:12000]}"),
    ]
    schema = {
        "type": "object",
        "properties": {"competencies": {"type": "array", "items": {}}},
        "required": ["competencies"],
    }
    return await structured_output(provider, model, messages, ExtractionResult, schema)
