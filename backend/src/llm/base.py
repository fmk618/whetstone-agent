# LLM 多服务商抽象层(方案 4.3)
from __future__ import annotations

from typing import AsyncIterator, Protocol, runtime_checkable

from pydantic import BaseModel


class ChatMessage(BaseModel):
    """统一聊天消息。role: system | user | assistant"""

    role: str
    content: str


class Capabilities(BaseModel):
    """服务商能力探测结果,驱动 JSON 等功能的降级策略。"""

    streaming: bool = True
    json_schema: bool = False  # 支持 response_format=json_schema
    json_object: bool = False  # 仅支持 json_object
    tool_calls: bool = False
    supports_list_models: bool = False
    context_window: int | None = None


class ProviderConfig(BaseModel):
    """单个服务商配置(providers.yaml 的一条)。不存任何明文 Key。"""

    id: str
    type: str = "openai_compatible"
    base_url: str
    api_key_env: str | None = None  # 引用环境变量 / keyring 条目名
    is_local: bool = False
    model_params: dict[str, dict] | None = None  # 按模型覆盖/锁定参数


@runtime_checkable
class LLMProvider(Protocol):
    id: str
    capabilities: Capabilities

    async def chat(self, messages: list[ChatMessage], *, model: str,
                   temperature: float = 0.3, **kw) -> str: ...

    def stream(self, messages: list[ChatMessage], *, model: str,
               **kw) -> AsyncIterator[str]: ...

    async def list_models(self) -> list[str]: ...

    async def embed(self, texts: list[str], *, model: str) -> list[list[float]]: ...
