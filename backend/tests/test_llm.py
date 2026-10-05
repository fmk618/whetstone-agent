# LLM 层单测:JSON 降级链、reasoning 分离、参数覆盖/锁定、隐私路由
from __future__ import annotations

import pytest
from pydantic import BaseModel

from src.llm.base import Capabilities, ChatMessage
from src.llm.structured import _extract_json, structured_output


class Out(BaseModel):
    name: str
    n: int


def test_extract_json_from_code_block():
    raw = "说明如下\n```json\n{\"name\": \"a\", \"n\": 1}\n```\n完毕"
    assert _extract_json(raw) == '{"name": "a", "n": 1}'


def test_extract_json_bare():
    assert _extract_json('前缀 {"name": "b", "n": 2} 后缀') == '{"name": "b", "n": 2}'


def test_extract_json_none():
    assert _extract_json("没有任何结构化内容") is None


class FakeProvider:
    """逐次返回不同输出的假 provider,用于驱动降级重试。"""

    id = "fake"

    def __init__(self, outputs: list[str], caps: Capabilities | None = None):
        self._outputs = outputs
        self._calls = 0
        self.capabilities = caps or Capabilities()

    async def chat(self, messages, *, model, temperature=0.3, json_schema=None, **kw):
        out = self._outputs[min(self._calls, len(self._outputs) - 1)]
        self._calls += 1
        return out


@pytest.mark.asyncio
async def test_structured_first_try_ok():
    p = FakeProvider(['{"name": "ok", "n": 3}'])
    out = await structured_output(p, "m", [ChatMessage(role="user", content="x")],
                                  Out, {"type": "object"})
    assert out.name == "ok" and out.n == 3
    assert p._calls == 1


@pytest.mark.asyncio
async def test_structured_retry_with_error_feedback():
    p = FakeProvider(["垃圾输出", '{"name": "fixed", "n": 9}'])
    out = await structured_output(p, "m", [ChatMessage(role="user", content="x")],
                                  Out, {"type": "object"})
    assert out.name == "fixed"
    assert p._calls == 2


@pytest.mark.asyncio
async def test_structured_exhausted():
    p = FakeProvider(["始终不是 JSON"])
    with pytest.raises(ValueError, match="降级链"):
        await structured_output(p, "m", [ChatMessage(role="user", content="x")],
                                Out, {"type": "object"})


def test_resolve_params_lock_and_override():
    from src.llm.openai_compat import _resolve_params

    params = {
        "kimi-k2.7-code": {"locked": ["temperature"]},
        "doubao-seed": {"extra_body": {"thinking": {"type": "disabled"}}},
    }
    r = _resolve_params(params, "kimi-k2.7-code", 0.7)
    assert r.temperature == 0.3 and "temperature" in r.locked
    r2 = _resolve_params(params, "doubao-seed", 0.7)
    assert r2.extra_body == {"thinking": {"type": "disabled"}}
    r3 = _resolve_params(None, "any", 0.5)
    assert r3.temperature == 0.5 and r3.extra_body == {}
