# 行业包(packs)加载:每包 pack.yaml(能力库/题族)+ rubric.yaml(评分维度)+ prompts/
from __future__ import annotations

from pathlib import Path

import yaml

from .config import settings

PACK_ID_RE = r"^[A-Za-z0-9_\-]+$"


def pack_dir(pack_id: str) -> Path:
    """包自带目录:backend/packs/<pack_id>。pack_id 只允许字母数字下划线连字符,防路径穿越。"""
    import re

    if not re.fullmatch(PACK_ID_RE, pack_id or ""):
        raise FileNotFoundError(f"非法 pack_id: {pack_id!r}")
    return settings.config_dir.parent / "packs" / pack_id


def load_pack(pack_id: str) -> dict:
    """读行业包:pack.yaml + rubric.yaml,合并为 {"id","name","question_families",
    "competencies","rubric":{"dims":[...]},"prompts":{"generate":..., "probe":...}}。

    找不到包或文件时抛 FileNotFoundError。
    """
    d = pack_dir(pack_id)
    pack_path = d / "pack.yaml"
    rubric_path = d / "rubric.yaml"
    if not pack_path.exists():
        raise FileNotFoundError(f"行业包不存在: {pack_id}(缺 {pack_path})")
    if not rubric_path.exists():
        raise FileNotFoundError(f"行业包 {pack_id} 缺 rubric.yaml: {rubric_path}")

    pack = yaml.safe_load(pack_path.read_text(encoding="utf-8")) or {}
    rubric = yaml.safe_load(rubric_path.read_text(encoding="utf-8")) or {}
    merged = {**pack, "rubric": rubric}

    prompts: dict[str, str] = {}
    prompts_dir = d / "prompts"
    if prompts_dir.is_dir():
        for name in ("generate", "probe"):
            p = prompts_dir / f"{name}.md"
            if p.exists():
                prompts[name] = p.read_text(encoding="utf-8")
    merged["prompts"] = prompts
    return merged


def list_packs() -> list[str]:
    """列出现在可用的 pack_id(目录里有 pack.yaml 的)。"""
    root = settings.config_dir.parent / "packs"
    if not root.is_dir():
        return []
    return sorted(
        d.parent.name for d in root.glob("*/pack.yaml") if d.parent.is_dir()
    )
