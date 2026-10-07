# FastAPI 入口:异常映射 / CORS / 静态托管 / lifespan(方案 4.x)
from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from openai import APIConnectionError

from ..llm.router import PrivacyNotConfirmed
from .routes_docs import router as docs_router
from .routes_quiz import router as quiz_router
from .routes_settings import router as settings_router

logger = logging.getLogger("whetstone")

BACKEND_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = BACKEND_ROOT.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # host 固定 127.0.0.1(方案 4.9:公网部署必须经反代 + HTTPS + 认证);端口读配置
    from ..config import settings
    logger.info("Whetstone API 监听地址: http://%s:%s (host 固定 127.0.0.1,"
                " 公网部署请走反向代理 + HTTPS + 认证)", settings.host, settings.port)
    yield


app = FastAPI(title="Whetstone API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(docs_router, prefix="/api")
app.include_router(quiz_router, prefix="/api")
app.include_router(settings_router, prefix="/api")


# -- 异常映射 ----------------------------------------------------------------

@app.exception_handler(PrivacyNotConfirmed)
async def privacy_handler(request: Request, exc: PrivacyNotConfirmed):
    return JSONResponse(status_code=409,
                        content={"detail": str(exc), "provider_id": exc.provider_id})


@app.exception_handler(APIConnectionError)
async def provider_connection_handler(request: Request, exc: APIConnectionError):
    logger.warning("LLM provider connection failed: %s", type(exc).__name__)
    return JSONResponse(
        status_code=502,
        headers={"Retry-After": "5"},
        content={
            "detail": "云端模型连接失败，请检查 Qwen API Key、模型配置或网络后重试。",
            "code": "provider_unavailable",
            "retryable": True,
        },
    )


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


# -- 生产托管:前端构建产物存在则挂到根路径 -------------------------------------

if FRONTEND_DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
