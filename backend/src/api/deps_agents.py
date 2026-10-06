# 智能体层依赖组装:路由器 / 嵌入函数 / 检索器(出题与评分共用;测试可整体替换)
from __future__ import annotations

from fastapi import HTTPException

from ..llm.router import PrivacyNotConfirmed

from . import deps  # noqa: F401  re-export get_db 等

__all__ = ["get_agent_router", "embed_texts", "get_retriever",
           "generate_role_provider"]


def get_agent_router():
    """Router(get_registry()):调用时经模块属性取 get_registry,便于测试替换。"""
    from ..llm import registry as registry_mod
    from ..llm.router import Router

    return Router(registry_mod.get_registry())


async def embed_texts(rt, texts: list[str], *, sens_confirmed: bool = False,
                      sens_markers: list[str] | None = None) -> list[list[float]]:
    """按 embed 角色路由嵌入;异常映射:ValueError → 400(路由未配置等)
    PrivacyNotConfirmed → 409(main 已映射);其余 → 400 并带可操作中文提示。"""
    try:
        decision = rt.route("embed", sens_confirmed=sens_confirmed,
                            sens_markers=sens_markers)
        provider = rt.registry.get(decision.provider_id)
        if provider is None:
            raise ValueError(f"嵌入厂商不存在: {decision.provider_id}")
        return await rt.embed(texts, sens_confirmed=sens_confirmed,
                              sens_markers=sens_markers)
    except (ValueError, HTTPException, PrivacyNotConfirmed):
        raise  # ValueError 交给 main 统一转 400(路由未配置等);PrivacyNotConfirmed → 409
    except Exception as exc:  # 网络/厂商报错统一转 400,带可操作提示
        raise HTTPException(status_code=400,
                            detail=f"嵌入调用失败:{exc}。"
                                   "请检查嵌入模型配置与服务可用性。") from exc


_retriever_cache: tuple = None  # ("__marker__", HybridRetriever)


def get_retriever():
    """HybridRetriever(VectorStore());模块级缓存同一实例(测试可 monkeypatch)。"""
    global _retriever_cache
    from ..config import settings
    from ..retrieval.hybrid import HybridRetriever
    from ..retrieval.store import VectorStore

    if _retriever_cache is None:
        _retriever_cache = ("__marker__",
                            HybridRetriever(VectorStore(settings.vectorstore_dir)))
    return _retriever_cache[1]


class _RoleProvider:
    """把 Router 包装成 provider 协议(agents.generator/evaluator 的 structured_output
    第一个参数实际是 provider:需要 .capabilities 与 .chat(json_schema=...)。
    chat 经 Router.route 做 409 链路,再转发到实际厂商。"""

    def __init__(self, rt, role: str = "generate", *, sens_confirmed: bool = False,
                 sens_markers: list[str] | None = None):
        self._rt = rt
        self._role = role
        self._sens_confirmed = sens_confirmed
        self._sens_markers = sens_markers
        self._caps = None

    @property
    def capabilities(self):
        if self._caps is None:
            d = self._rt.route(self._role, sens_confirmed=self._sens_confirmed,
                               sens_markers=self._sens_markers)
            provider = self._rt.registry.get(d.provider_id)
            self._caps = provider.capabilities if provider else None
        return self._caps

    async def chat(self, messages, *, model=None, **kw):
        return await self._rt.chat(self._role, messages,
                                   sens_confirmed=self._sens_confirmed,
                                   sens_markers=self._sens_markers, **kw)


def generate_role_provider(rt, *, role: str = "generate",
                           sens_confirmed: bool = False,
                           sens_markers: list[str] | None = None) -> _RoleProvider:
    """agents 层 structured_output 期望 provider 协议;包一层以接入 Router 的 409 链路。"""
    return _RoleProvider(rt, role, sens_confirmed=sens_confirmed,
                         sens_markers=sens_markers)
