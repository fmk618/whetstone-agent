# 服务商注册与配置加载。Key 只经 env / keyring 解析,永不落配置文件明文。
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml

from .base import Capabilities, ProviderConfig
from .openai_compat import OpenAICompatProvider

# 4.2 国内厂商预设:只预填 base_url,用户可改;模型名一律不写死
PRESETS: dict[str, str] = {
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "doubao": "https://ark.cn-beijing.volces.com/api/v3",
    "kimi": "https://api.moonshot.cn/v1",
    "deepseek": "https://api.deepseek.com",
    "qianfan": "https://qianfan.baidubce.com/v2",
    "ollama": "http://localhost:11434/v1",
    "lm_studio": "http://localhost:1234/v1",
}


def _resolve_api_key(api_key_env: str | None) -> str | None:
    """按优先级解析 Key:环境变量(含 .env 已加载的)→ None。"""
    if not api_key_env:
        return None
    return os.environ.get(api_key_env) or None


def load_provider_configs(config_dir: Path) -> list[ProviderConfig]:
    path = config_dir / "providers.yaml"
    if not path.exists():
        return []
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return [ProviderConfig.model_validate(item) for item in data.get("providers", [])]


@lru_cache(maxsize=1)
def get_registry() -> "Registry":
    from ..config import settings  # noqa: PLC0415 局部导入避免循环

    return Registry(settings.config_dir)


class Registry:
    """加载 providers.yaml,按需实例化 Provider;支持运行时增删(设置页)。"""

    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self._configs: dict[str, ProviderConfig] = {
            c.id: c for c in load_provider_configs(config_dir)
        }
        self._instances: dict[str, OpenAICompatProvider] = {}

    def list_ids(self) -> list[str]:
        return list(self._configs)

    def get(self, provider_id: str) -> OpenAICompatProvider | None:
        if provider_id in self._instances:
            return self._instances[provider_id]
        cfg = self._configs.get(provider_id)
        if not cfg:
            return None
        match cfg.type:
            case "openai_compatible":
                inst = OpenAICompatProvider(
                    provider_id=cfg.id,
                    base_url=cfg.base_url,
                    api_key=_resolve_api_key(cfg.api_key_env),
                    model_params=cfg.model_params,
                    capabilities=self._probe(cfg),
                )
            case _:
                raise NotImplementedError(f"未实现的适配器类型: {cfg.type}")
        self._instances[provider_id] = inst
        return inst

    @staticmethod
    def _probe(cfg: ProviderConfig) -> Capabilities:
        """能力探测:openai_compatible 面上普遍支持流式;list_models 多数支持,
        会实际尝试时再降级(见 OpenAICompatProvider.list_models 的异常兜底)。"""
        return Capabilities(streaming=True, json_object=True, supports_list_models=True)

    def is_local(self, provider_id: str) -> bool:
        cfg = self._configs.get(provider_id)
        return bool(cfg and cfg.is_local)

    def upsert(self, cfg: ProviderConfig) -> None:  # 设置页编辑
        self._configs[cfg.id] = cfg
        self._instances.pop(cfg.id, None)
        self.save()

    def delete(self, provider_id: str) -> None:
        self._configs.pop(provider_id, None)
        self._instances.pop(provider_id, None)
        self.save()

    def save(self) -> None:
        path = self.config_dir / "providers.yaml"
        data = {"providers": [c.model_dump() for c in self._configs.values()]}
        path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
                        encoding="utf-8")
