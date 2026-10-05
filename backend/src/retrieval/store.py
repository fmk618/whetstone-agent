# 向量库(Chroma,personal/reference 两集合)+ 嵌入模型绑定(方案 4.7/7.3)
from __future__ import annotations

import json
from pathlib import Path

import chromadb

from ..config import settings
from ..ingest.chunker import Chunk


class VectorStore:
    """两个集合:personal(简历/项目/笔记,找证据)与 reference(参考资料,找标准考点)。"""

    COLLECTIONS = ("personal", "reference")

    def __init__(self, path: Path | None = None):
        self._client = chromadb.PersistentClient(path=str(path or settings.vectorstore_dir))

    def _col(self, name: str):
        if name not in self.COLLECTIONS:
            raise ValueError(f"未知集合: {name}")
        return self._client.get_or_create_collection(name, metadata={"hnsw:space": "cosine"})

    @staticmethod
    def _embed_meta(provider_id: str, model: str, dim: int) -> dict:
        return {"embed_provider": provider_id, "embed_model": model, "embed_dim": dim}

    def embedded_meta(self, collection: str) -> dict | None:
        """读取集合元数据里绑定的嵌入模型;不存在则 None(空库)。"""
        try:
            meta = self._client.get_collection(collection).metadata or {}
        except Exception:
            return None
        if not meta.get("embed_model"):
            return None
        return {k: meta[k] for k in ("embed_provider", "embed_model", "embed_dim") if k in meta}

    def needs_rebuild(self, collection: str, provider_id: str, model: str, dim: int) -> bool:
        cur = self.embedded_meta(collection)
        if not cur:
            return False  # 空库直接用
        # 方案 4.7:换模型或换维度都不允许新旧向量混用
        return (cur["embed_model"] != model
                or cur.get("embed_provider") != provider_id
                or cur.get("embed_dim") != dim)

    def add(self, collection: str, chunks: list[Chunk], embeddings: list[list[float]],
            *, embed_provider: str, embed_model: str, doc_id: str,
            sensitivity: str = "cloud_ok") -> None:
        if len(chunks) != len(embeddings):
            raise ValueError("chunks 与 embeddings 数量不一致")
        col = self._col(collection)
        col.upsert(
            ids=[f"{doc_id}:{c.index}" for c in chunks],
            documents=[c.text for c in chunks],
            metadatas=[{"file": c.file, "section": c.section, "doc_id": doc_id,
                        "sensitivity": sensitivity,
                        **self._embed_meta(embed_provider, embed_model,
                                           len(embeddings[0]) if embeddings else 0)}
                       for c in chunks],
            embeddings=embeddings,
        )

    def rebuild_collection(self, collection: str, provider_id: str, model: str, dim: int) -> None:
        """一键重建:删除后按新嵌入模型初始化,并绑定元数据。"""
        try:
            self._client.delete_collection(collection)
        except Exception:
            pass
        col = self._client.get_or_create_collection(
            collection, metadata={"hnsw:space": "cosine", **self._embed_meta(provider_id, model, dim)})
        return col

    def query(self, collection: str, embedding: list[float], *, top: int = 20,
              where: dict | None = None) -> list[dict]:
        col = self._col(collection)
        res = col.query(query_embeddings=[embedding], n_results=top, where=where or None)
        out = []
        for i in range(len(res["ids"][0])):
            out.append({
                "id": res["ids"][0][i],
                "text": res["documents"][0][i],
                "meta": res["metadatas"][0][i],
                "distance": res["distances"][0][i] if res.get("distances") else None,
            })
        return out

    def export_state(self, collection: str) -> str:  # 调试/备份用,非敏感输出
        col = self._col(collection)
        return json.dumps(col.metadata or {}, ensure_ascii=False)
