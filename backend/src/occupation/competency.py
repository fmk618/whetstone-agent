# 能力矩阵构建与简历匹配(方案 7.2):JD 关键词 → 权重 → A/B/C/D 分级 → 题量分配
# 本期纯规则实现(关键词频次/命中);LLM 归一能力名延后,见文末 TODO。
from __future__ import annotations

import re
from collections import Counter
from typing import Literal

from pydantic import BaseModel, Field

ClaimStrength = Literal["has_metric", "listed_only", "none"]
MatchCategory = Literal["A", "B", "C", "D"]


class CompetencyItem(BaseModel):
    """能力项:出现在能力矩阵里的一个条目。weight 0-1,is_required 标识 JD 硬性要求。"""

    name: str
    weight: float = Field(ge=0, le=1)
    level: str = "general"  # general|basic|advanced,给检索 query 用


# 各证据等级的匹配类别:有量化指标 → A(充分证据),仅罗列 → B(需追问),没有 → C
_CLAIM_TO_CATEGORY: dict[ClaimStrength, MatchCategory] = {
    "has_metric": "A",
    "listed_only": "B",
    "none": "C",
}

# 风险系数:越缺证据越该多问。B=1.0(有声明没证据,验证需求最强)
_RISK: dict[MatchCategory, float] = {"A": 0.5, "B": 1.0, "C": 0.8}


def _tokenize(text: str) -> list[str]:
    """中文整词粗切:按标点/空白拆;英文数字整词小写。BM25 同款简化思路。"""
    return [t.lower() for t in re.split(r"[\s,，。;；:：、()（）\[\]【】]+", text) if t]


def _fuzzy_count(keyword: str, tokens: list[str]) -> int:
    """关键词在词元中的命中次数(含子串与英文小写匹配)。"""
    kw = keyword.lower()
    n = 0
    for tok in tokens:
        if kw == tok or kw in tok:
            n += 1
    return n


def build_matrix(jd_text: str, pack_competencies: list[dict] | list[CompetencyItem],
                 *, level: str = "general") -> list[CompetencyItem]:
    """JD 文本 × 行业包能力库 → 能力矩阵。

    规则:JD 中出现该能力名或有别名/关键词命中 → 进矩阵,权重 = 包权重 × 命中频次占比;
    没出现的条目按包里的小权重保留(弱关联)。本期纯规则,LLM 归一延后。

    Args:
        jd_text: 岗位描述原文
        pack_competencies: [{"name": ..., "weight": 0.x}, ...]
        level: 矩阵条目的默认等级
    Returns:
        list[CompetencyItem]
    TODO(延后): 用 LLM 把 JD 短语与能力名做语义对齐,再映射到标准能力体系。
    """
    tokens = _tokenize(jd_text or "")
    freq = Counter()
    for item in pack_competencies:
        c = CompetencyItem.model_validate(item) if not isinstance(item, CompetencyItem) else item
        hits = _fuzzy_count(c.name, tokens)
        if hits > 0:
            freq[c.name] = hits
    total = sum(freq.values())
    out: list[CompetencyItem] = []
    for item in pack_competencies:
        c = CompetencyItem.model_validate(item) if not isinstance(item, CompetencyItem) else item
        if total > 0 and c.name in freq:
            # JD 命中的能力:权重抬升(命中份额 × 额外权重)
            share = freq[c.name] / total
            w = min(1.0, c.weight + share * 0.3)
        else:
            # 未命中的能力:降为弱关联,给通用题留一分位
            w = c.weight * 0.1
        out.append(CompetencyItem(name=c.name, weight=round(w, 3), level=level))
    return out


def match_resume(matrix: list[CompetencyItem],
                 claims: list[tuple[str, ClaimStrength]]) -> list[tuple[CompetencyItem, MatchCategory]]:
    """能力矩阵 × 简历声明 → [(item, A|B|C)]。

    A = has_metric(有量化证据),B = listed_only(仅罗列),C = 什么都没有。
    D 类(硬性不达标)在分类阶段直接过滤掉,不返回,调用方按 A/B/C 出题。
    """
    strength_by_name: dict[str, ClaimStrength] = {}
    for competency, strength in claims:
        cur = strength_by_name.get(competency)
        # 同一能力多条声明时,取证据最强的那条
        if cur is None or _rank(strength) > _rank(cur):
            strength_by_name[competency] = strength

    out: list[tuple[CompetencyItem, MatchCategory]] = []
    for item in matrix:
        strength = strength_by_name.get(item.name)
        if strength is None:
            category: MatchCategory = "C"
        else:
            category = _CLAIM_TO_CATEGORY[strength]
        # D 类过滤(本期规则里没有 D 的触发条件,结构留位延后接入硬性校验)
        if category == "D":
            continue
        out.append((item, category))
    return out


def _rank(strength: ClaimStrength) -> int:
    """证据强度排序:has_metric > listed_only > none。"""
    order: dict[str, int] = {"has_metric": 2, "listed_only": 1, "none": 0}
    return order.get(strength, 0)


def allocate_question_counts(items: list[tuple[CompetencyItem, MatchCategory]],
                             total: int) -> dict[str, int]:
    """按"权重 × 风险系数" 分配 total 道题到各能力项。

    保证每个能力项至少 1 道(当 total >= len(items)),余数给剩余额度最大的项。
    Returns: {能力名: 题数},总和 == total(当 total >= len(items) 时)。
    """
    if not items or total <= 0:
        return {}

    priorities: list[tuple[str, float]] = []
    for item, category in items:
        risk = _RISK.get(category, 0.8)
        priorities.append((item.name, item.weight * risk))

    names = [name for name, _ in priorities]
    if total < len(names):
        # 题不够时按配额前 total 名拿题
        ranked = sorted(priorities, key=lambda p: -p[1])[:total]
        return {name: 1 for name, _ in ranked}

    base = {name: 1 for name in names}
    remain = total - len(names)
    quotes = [max(p, 1e-6) for _, p in priorities]
    quote_sum = sum(quotes)
    if quote_sum <= 0 or remain <= 0:
        return base

    # 最大余数法:先按配额 floor,余数给小数部分大的项
    raw = {name: q / quote_sum * remain for (name, _), q in zip(priorities, quotes)}
    for name, v in raw.items():
        base[name] += int(v)
    remain -= sum(int(v) for v in raw.values())
    by_frac = sorted(raw, key=lambda n: -(raw[n] - int(raw[n])))
    for name in by_frac:
        if remain <= 0:
            break
        base[name] += 1
        remain -= 1
    return base
