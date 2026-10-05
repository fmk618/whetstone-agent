# API 层依赖:Database + get_db 单例(测试可整体替换 get_db)
from __future__ import annotations

from ..db import Database, get_db  # re-export

__all__ = ["Database", "get_db"]
