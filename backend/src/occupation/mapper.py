# 岗位名归一:把用户随手写的岗位标题映射到标准岗位名(方案 7.2)
# 本期用内置同义词表做轻量实现;全量职业大典映射延后,见文末 TODO。
from __future__ import annotations

from dataclasses import dataclass

# 标准岗位名 → 常见写法/别名(中英都有;匹配时大小写不敏感)。
# 结构: {标准名: [别名...]} ;标准名自身也算命中。
_SYNONYMS: dict[str, list[str]] = {
    "软件开发工程师": ["后端开发", "后端工程师", "backend", "backend engineer",
                    "软件开发", "研发工程师", "java开发", "python开发", "go开发",
                    "程序员", "software engineer", "developer"],
    "前端开发工程师": ["前端", "前端工程师", "frontend", "web前端", "h5开发",
                   "frontend engineer", "web developer"],
    "算法工程师": ["机器学习", "深度学习", "nlp", "cv", "计算机视觉", "推荐算法",
               "machine learning", "ml engineer", "ai engineer"],
    "数据分析师": ["数据分析", "数据运营", "bi", "商业分析", "data analyst",
              "数据专员"],
    "数据工程师": ["数仓", "数据仓库", "大数据开发", "etl", "data engineer"],
    "产品经理": ["pm", "产品助理", "产品设计", "互联网产品", "product manager"],
    "互联网运营": ["运营专员", "用户运营", "增长运营", "内容运营", "社区运营",
              "新媒体运营", "活动运营", "operations", "运营"],
    "测试工程师": ["软件测试", "qa", "测试开发", "自动化测试", "test engineer"],
    "运维工程师": ["devops", "sre", "系统运维", "稳定性保障", "ops"],
    "项目经理": ["项目主管", "pmo", "交付经理", "project manager"],
    "市场专员": ["市场营销", "品牌推广", "市场运营", "marketing"],
    "销售": ["销售代表", "销售经理", "客户经理", "大客户销售", "sales"],
    "人力资源": ["hr", "人事", "招聘", "hrbp", "薪酬绩效"],
    "设计师": ["ui设计", "ux设计", "交互设计", "视觉设计", "平面设计",
            "ui/ux", "product designer"],
    "财务": ["会计", "出纳", "财务专员", "审计", "finance", "accounting"],
    "运营助理": ["运营实习生", "运营专员助理"],
}


@dataclass
class OccupationMatch:
    """一个岗位标题的归一结果。标准名 + 置信度(直接命中 1.0,子串 0.8)。"""

    standard: str
    confidence: float


def normalize(title: str) -> str:
    """标题 → 标准岗位名;未收录的返回去掉首尾空白的原文(不强行猜)。"""
    t = (title or "").strip().lower()
    if not t:
        return ""
    for standard, aliases in _SYNONYMS.items():
        if t == standard.lower() or t in [a.lower() for a in aliases]:
            return standard
        # 别名是标题的连续子串也算(如"高级后端开发工程师")
        for alias in [a.lower() for a in aliases] + [standard.lower()]:
            if alias in t:
                return standard
    return (title or "").strip()


def match_occupation(title: str) -> OccupationMatch | None:
    """标题 → (标准名, 置信度)。完整命中 1.0,子串 0.8,未收录返回 None。

    TODO(延后): 按国家职业分类大典做全量映射 + 语义相似度兜底;
    届时标准名直接来自大典代码,置信度由文本相似度计算。
    """
    t = (title or "").strip().lower()
    if not t:
        return None
    for standard, aliases in _SYNONYMS.items():
        candidates = [standard.lower()] + [a.lower() for a in aliases]
        if t in candidates:
            return OccupationMatch(standard=standard, confidence=1.0)
    for standard, aliases in _SYNONYMS.items():
        for alias in [standard.lower()] + [a.lower() for a in aliases]:
            if alias in t:
                return OccupationMatch(standard=standard, confidence=0.8)
    return None
