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

    def route(self, role: str, *, sens_confirmed: bool = False,
              sens_markers: list[str] | None = None) -> RouteDecision:
        if role not in ROLES:
            raise ValueError(f"未知角色: {role}")
        entry = (settings.yaml_data.get("routing") or {}).get(role)
        if not entry:
            raise ValueError(f"settings.yaml 未配置角色路由: {role}")
        provider_id, model = entry["provider"], entry["model"]
        is_local = self.registry.is_local(provider_id)
        # 隐私策略:仅当调用方声明本次请求含 local_only 敏感内容(sens_markers)且
        # 目标是云端时,才要求用户知情确认。普通问答/出题不涉及原文,直接放行。
        if not is_local and sens_markers and not sens_confirmed:
            raise PrivacyNotConfirmed(provider_id)
        return RouteDecision(provider_id=provider_id, model=model, is_local=is_local)

    async def chat(self, role: str, messages: list[ChatMessage],
                   *, sens_confirmed: bool = False,
                   sens_markers: list[str] | None = None, **kw) -> str:
        d = self.route(role, sens_confirmed=sens_confirmed, sens_markers=sens_markers)
        provider = self.registry.get(d.provider_id)
        if provider is None:
            raise ValueError(f"路由指向的厂商不存在: {d.provider_id}(请在设置页检查)")
        return await provider.chat(messages, model=d.model, **kw)

    async def embed(self, texts: list[str], *, sens_confirmed: bool = False,
                    sens_markers: list[str] | None = None) -> list[list[float]]:
        d = self.route("embed", sens_confirmed=sens_confirmed, sens_markers=sens_markers)
        provider = self.registry.get(d.provider_id)
        if provider is None:
            raise ValueError(f"路由指向的厂商不存在: {d.provider_id}")
        return await provider.embed(texts, model=d.model)
