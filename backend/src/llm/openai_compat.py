# openai_compatible 适配器:千问/豆包/Kimi/DeepSeek/Ollama 等通用
from __future__ import annotations

import json
from typing import Any, AsyncIterator

from openai import AsyncOpenAI
from pydantic import BaseModel

from .base import Capabilities, ChatMessage

# 思考内容所在字段(方案 4.2 要点 4):与正文分离,不混进 JSON
REASONING_FIELD = "reasoning_content"


class ResolvedParams(BaseModel):
    """处理过覆盖/锁定逻辑后的一次请求参数。"""

    temperature: float = 0.3
    extra_body: dict[str, Any] = {}
    locked: list[str] = []


def _resolve_params(model_params: dict[str, dict] | None, model: str,
                    temperature: float, extra_body: dict[str, Any] | None = None) -> ResolvedParams:
    """按模型 ID 覆盖参数与锁定参数(方案 4.2 要点 3)。

    providers.yaml 形如:
        model_params:
          "kimi-k2.7-code": { locked: [temperature] }
          "<豆包模型ID>":   { extra_body: { thinking: { type: disabled } } }
    """
    merged_extra = dict(extra_body or {})
    locked: list[str] = []
    override_temp: float | None = None

    if model_params:
        entry = model_params.get(model) or model_params.get("*") or {}
        locked = list(entry.get("locked", []))
        if "extra_body" in entry:
            merged_extra.update(entry["extra_body"])
        if "temperature" in entry and "temperature" not in locked:
            override_temp = float(entry["temperature"])

    temp = temperature
    if "temperature" in locked:
        temp = 0.3  # 锁定时用厂商默认,调用方传来的值被忽略
    elif override_temp is not None:
        temp = override_temp
    return ResolvedParams(temperature=temp, extra_body=merged_extra, locked=locked)


class OpenAICompatProvider:
    """只依赖统一接口的业务代码永远不出现厂商名;本类是唯一的协议方言层。"""

    def __init__(self, provider_id: str, base_url: str, api_key: str | None,
                 model_params: dict[str, dict] | None = None,
                 capabilities: Capabilities | None = None,
                 json_mode_fallback: bool = True):
        self.id = provider_id
        self.capabilities = capabilities or Capabilities()
        self._json_mode_fallback = json_mode_fallback
        self._params = _resolve_params(model_params, "<unset>", 0.3)  # 占位;真实值在调用时解析
        self._model_params = model_params
        # 某些厂商要求非空 Key,Ollama 等本地端点传 "local"
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key or "local")

    # -- 聊天 ------------------------------------------------------------
    async def chat(self, messages: list[ChatMessage], *, model: str,
                   temperature: float = 0.3, json_schema: dict | None = None,
                   **kw) -> str:
        resolved = _resolve_params(self._model_params, model, temperature)
        request_kw: dict[str, Any] = dict(
            model=model,
            messages=[m.model_dump() for m in messages],
            temperature=resolved.temperature,
            extra_body=resolved.extra_body or None,
        )
        if json_schema and self.capabilities.json_schema:
            request_kw["response_format"] = {
                "type": "json_schema",
                "json_schema": {"name": "output", "strict": False, "schema": json_schema},
            }
            request_kw.pop("temperature", None)  # strict 模式常不允许自定义温度
        elif json_schema and self.capabilities.json_object:
            request_kw["response_format"] = {"type": "json_object"}
        resp = await self._client.chat.completions.create(**request_kw)
        # ChatCompletion 传 message;留兼容:非分块响应统一取 .message
        return self._extract_content(resp.choices[0].message)

    async def stream(self, messages: list[ChatMessage], *, model: str,
                     temperature: float = 0.3, **kw) -> AsyncIterator[str]:
        resolved = _resolve_params(self._model_params, model, temperature)
        stream = await self._client.chat.completions.create(
            model=model,
            messages=[m.model_dump() for m in messages],
            temperature=resolved.temperature,
            stream=True,
            extra_body=resolved.extra_body or None,
        )
        async for chunk in stream:
            if chunk.choices:
                delta = chunk.choices[0].delta
                text = self._extract_content(delta)
                if text:
                    yield text

    @staticmethod
    def _extract_content(obj: Any) -> str:
        """剥掉 reasoning_content,只取正文(思考模型防护)。"""
        content = getattr(obj, "content", None)
        if isinstance(content, str):
            return content
        if isinstance(content, list):  # 部分厂商返回分段数组
            return "".join(p.get("text", "") for p in content if isinstance(p, dict))
        return ""

    # -- 模型列表 ----------------------------------------------------------
    async def list_models(self) -> list[str]:
        if not self.capabilities.supports_list_models:
            return []
        try:
            resp = await self._client.models.list()
            return sorted(m.id for m in resp.data)
        except Exception:
            return []  # 不支持的厂商返回空,前端降级为手动输入

    # -- 嵌入 --------------------------------------------------------------
    async def embed(self, texts: list[str], *, model: str) -> list[list[float]]:
        resp = await self._client.embeddings.create(model=model, input=texts)
        return [item.embedding for item in resp.data]

    # -- 结构化 JSON --------------------------------------------------------
    async def structured_parts(self, text: str) -> tuple[str, str]:
        """返回 (正文, 思考内容);供错误回传重试时区分使用。"""
        try:
            data = json.loads(text) if isinstance(text, str) else {}
        except (json.JSONDecodeError, TypeError):
            return text or "", ""
        if isinstance(data, dict) and REASONING_FIELD in data:
            return str(data.get("content", "")), str(data[REASONING_FIELD])
        return text, ""
