# 全局配置:.env(按 APP_ENV 区分)+ config/settings.yaml
from __future__ import annotations

import os
from pathlib import Path

import yaml
from dotenv import load_dotenv
from pydantic import BaseModel

BACKEND_ROOT = Path(__file__).resolve().parent.parent

APP_ENV = os.environ.get("APP_ENV", "development")


def _load_env() -> None:
    load_dotenv(BACKEND_ROOT / f".env.{APP_ENV}", override=False)


_load_env()


class Settings(BaseModel):
    data_dir: Path = BACKEND_ROOT.parent / "data"
    host: str = "127.0.0.1"
    port: int = 8000

    @property
    def config_dir(self) -> Path:
        return BACKEND_ROOT / "config"

    @property
    def db_path(self) -> Path:
        return self.data_dir / "app.db"

    @property
    def vectorstore_dir(self) -> Path:
        return self.data_dir / "vectorstore"

    @property
    def raw_dir(self) -> Path:
        return self.data_dir / "raw"

    @property
    def yaml_data(self) -> dict:
        path = self.config_dir / "settings.yaml"
        return yaml.safe_load(path.read_text(encoding="utf-8")) or {} if path.exists() else {}


settings = Settings()

for d in (settings.data_dir, settings.raw_dir, settings.vectorstore_dir):
    d.mkdir(parents=True, exist_ok=True)
