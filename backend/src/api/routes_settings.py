# 设置页:服务商配置(永不回传明文 Key)/ 角色路由 / 部署模式提示
from __future__ import annotations

import os

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings
from ..llm.base import ProviderConfig
from ..llm.registry import PRESETS

router = APIRouter(prefix="/settings", tags=["settings"])

VALID_TYPES = {"openai_compatible"}


def _registry():
    # 调用时经模块属性取 get_registry,便于测试替换 Registry 指向
    from ..llm import registry as registry_mod
    return registry_mod.get_registry()


class ProviderIn(BaseModel):
    id: str
    type: str = "openai_compatible"
    base_url: str
    api_key_env: str | None = None
    is_local: bool = False
    model_params: dict[str, dict] | None = None


class RoutingIn(BaseModel):
    routing: dict[str, dict]


def _provider_out(cfg: ProviderConfig) -> dict:
    """api_key_env 字段只回"已设置/未设置"(按 os.environ 判断),绝不返回明文或变量名。"""
    status = "已设置" if (cfg.api_key_env and os.environ.get(cfg.api_key_env)) else "未设置"
    out = cfg.model_dump()
    out["api_key_env"] = status
    return out


@router.get("/providers")
def list_providers() -> dict:
    reg = _registry()
    return {
        "providers": [_provider_out(reg._configs[cid]) for cid in reg.list_ids()],
        "presets": PRESETS,
    }


@router.put("/providers")
def upsert_provider(body: ProviderIn) -> dict:
    if body.type not in VALID_TYPES:
        raise HTTPException(status_code=400,
                            detail=f"不支持的适配器类型: {body.type}")
    if not body.base_url.strip():
        raise HTTPException(status_code=400, detail="base_url 不能为空")
    data = body.model_dump()
    # 前端把 GET 回显的"已设置/未设置"原样传回时,保留原配置里的环境变量名
    if data.get("api_key_env") in ("已设置", "未设置"):
        cur = _registry()._configs.get(body.id)
        data["api_key_env"] = cur.api_key_env if cur else None
    cfg = ProviderConfig.model_validate(data)
    _registry().upsert(cfg)
    return _provider_out(cfg)


@router.post("/providers/test")
async def test_provider(body: dict) -> dict:
    """list_models() 实测连通性;失败只回错误摘要,不泄露 Key。"""
    provider_id = (body or {}).get("id")
    if not provider_id:
        raise HTTPException(status_code=400, detail="缺少 id")
    reg = _registry()
    if provider_id not in reg.list_ids():
        raise HTTPException(status_code=404, detail=f"服务商不存在: {provider_id}")
    provider = reg.get(provider_id)
    if provider is None:
        return {"ok": False, "models": [], "error": f"无法实例化: {provider_id}"}
    try:
        models = await provider.list_models()
    except Exception as exc:  # 连接失败等;摘要信息不包含请求头/Key
        return {"ok": False, "models": [], "error": f"{type(exc).__name__}: {exc}"}
    return {"ok": True, "models": models, "error": None}


@router.delete("/providers/{provider_id}")
def delete_provider(provider_id: str) -> dict:
    reg = _registry()
    if provider_id not in reg.list_ids():
        raise HTTPException(status_code=404, detail=f"服务商不存在: {provider_id}")
    reg.delete(provider_id)
    return {"deleted": provider_id}


# -- 角色路由(read/write settings.yaml 的 routing 段) ------------------------

def _yaml_path():
    return settings.config_dir / "settings.yaml"


@router.get("/routing")
def get_routing() -> dict:
    path = _yaml_path()
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {} if path.exists() else {}
    return {"routing": data.get("routing") or {}}


@router.put("/routing")
def put_routing(body: RoutingIn) -> dict:
    path = _yaml_path()
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {} if path.exists() else {}
    data["routing"] = body.routing
    path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
                    encoding="utf-8")
    return {"routing": body.routing}


# -- 部署模式提示(方案 4.9) ---------------------------------------------------

@router.get("/keyring-hint")
def keyring_hint() -> dict:
    return {
        "local": "本地模式:Key 保存在本机 backend/.env.development(或系统 keyring),"
                 "数据库与向量库都在 data/ 目录,不上传任何内容到第三方。",
        "public": "公网部署:必须启用 HTTPS 并配置访问认证(反向代理 + 账号/令牌),"
                  "Key 建议放服务端环境变量或 keyring,禁止打包进前端(方案 4.9)。",
    }
