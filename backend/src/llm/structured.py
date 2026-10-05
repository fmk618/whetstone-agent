# 结构化输出的能力降级链(方案 4.5)
from __future__ import annotations

import json
import re
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from .base import ChatMessage

T = TypeVar("T", bound=BaseModel)

_MAX_RETRIES = 2

_JSON_BLOCK = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL)
_JSON_OBJ = re.compile(r"\{.*\}|\[.*\]", re.DOTALL)


def _extract_json(text: str) -> str | None:
    """第三级降级:从正文里正则抽取 JSON(代码块优先)。"""
    for m in _JSON_BLOCK.finditer(text):
        return m.group(1).strip()
    m = _JSON_OBJ.search(text)
    return m.group(0) if m else None


async def structured_output(provider, model: str, messages: list[ChatMessage],
                            schema: type[T], schema_dict: dict,
                            temperature: float = 0.3) -> T:
    """按 provider.capabilities 逐级降级;解析/校验失败把错误回传重试(≤2 次)。"""
    caps = provider.capabilities
    last_err: str = ""

    for attempt in range(_MAX_RETRIES + 1):
        extra = ""
        if attempt > 0:
            extra = (f"\n\n你上一次的输出无法解析,错误信息:\n{last_err}\n"
                     "请严格只输出一个符合上述 JSON Schema 的 JSON 对象,不要任何多余文字。")
        convo = [*messages, ChatMessage(role="user", content=extra.strip())] if extra else messages

        raw = await provider.chat(convo, model=model, temperature=temperature,
                                  json_schema=schema_dict)
        candidate = raw if raw.lstrip().startswith(("{", "[")) else (_extract_json(raw) or "")
        if not candidate:
            last_err = "输出中未找到 JSON"
            continue
        try:
            return schema.model_validate_json(candidate)
        except ValidationError as exc:
            last_err = str(exc.errors()[:3])

    raise ValueError(f"结构化输出降级链重试 {_MAX_RETRIES} 次仍失败: {last_err}")
