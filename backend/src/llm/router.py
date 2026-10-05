# 角色路由 + 隐私检查(方案 4.4/4.6,按计划修订为"知情确认制")
from __future__ import annotations

from dataclasses import dataclass

from ..config import settings
from .base import ChatMessage
from .registry import Registry

# 任务角色:extract=简历/项目抽取 generate=出题 evaluate=评分 interview=面试追问 embed=嵌入
ROLES = ("extract", "generate", "evaluate", "interview", "embed")


@dataclass
class RouteDecision:
    provider_id: str
    model: str
    is_local: bool


class PrivacyNotConfirmed(Exception):
    """local_only 内容发云端未获用户确认。前端捕获后弹知情窗。"""

    def __init__(self, provider_id: str):
        self.provider_id = provider_id
        super().__init__(
            f"内容含敏感标记(local_only),发送给云端厂商 {provider_id} 前需用户确认")


class Router:
    def __init__(self, registry: Registry):
        self.registry = registry

    def route(self, role: str, *, sens_confirmed: bool = False) -> RouteDecision:
        if role not in ROLES:
            raise ValueError(f"未知角色: {role}")
        entry = (settings.yaml_data.get("routing") or {}).get(role)
        if not entry:
            raise ValueError(f"settings.yaml 未配置角色路由: {role}")
        provider_id, model = entry["provider"], entry["model"]
        is_local = self.registry.is_local(provider_id)
        if not is_local and not sens_confirmed:
            # 方案 4.6 与计划修订:无本地模型时不硬阻塞,由调用方(UX 层)确认后带 sens_confirmed 传入
            raise PrivacyNotConfirmed(provider_id)
        return RouteDecision(provider_id=provider_id, model=model, is_local=is_local)

    async def chat(self, role: str, messages: list[ChatMessage],
                   *, sens_confirmed: bool = False, **kw) -> str:
        d = self.route(role, sens_confirmed=sens_confirmed)
        provider = self.registry.get(d.provider_id)
        if provider is None:
            raise ValueError(f"路由指向的厂商不存在: {d.provider_id}(请在设置页检查)")
        return await provider.chat(messages, model=d.model, **kw)

    async def embed(self, texts: list[str], *, sens_confirmed: bool = False) -> list[list[float]]:
        d = self.route("embed", sens_confirmed=sens_confirmed)
        provider = self.registry.get(d.provider_id)
        if provider is None:
            raise ValueError(f"路由指向的厂商不存在: {d.provider_id}")
        return await provider.embed(texts, model=d.model)
