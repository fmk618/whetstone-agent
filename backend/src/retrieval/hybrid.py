# 混合检索:向量 + BM25 融合,取 top5(rerank 延后 P2,方案 7.3)
from __future__ import annotations

import json
import re
from dataclasses import dataclass

from rank_bm25 import BM25Okapi

from .store import VectorStore

_WORD = re.compile(r"[\w一-鿿]+", re.UNICODE)


def _tokenize(text: str) -> list[str]:
    """中文按单字 + 英数整词,BM25 够用的简化分词。"""
    return _WORD.findall(text.lower())


@dataclass
class Retrieved:
    text: str
    file: str
    section: str
    score: float  # RRF 融合分


class HybridRetriever:
    """对每个能力项生成检索查询(能力名 + 场景 + 等级),同时查两个集合(方案 7.3)。"""

    def __init__(self, store: VectorStore):
        self.store = store

    def search(self, collection: str, query: str, embedding: list[float],
               *, final_top: int = 5, vector_top: int = 20, bm25_top: int = 20) -> list[Retrieved]:
        vec_hits = self.store.query(collection, embedding, top=vector_top)
        text_hits = self._bm25(collection, query, top=bm25_top)
        # Reciprocal Rank Fusion
        scores: dict[str, Retrieved] = {}
        K = 60.0
        for rank, hit in enumerate(vec_hits):
            key = hit["id"]
            r = Retrieved(text=hit["text"], file=hit["meta"]["file"],
                          section=hit["meta"]["section"], score=0.0)
            r.score += 1.0 / (K + rank + 1)
            scores[key] = r
        for rank, hit in enumerate(text_hits):
            if hit["id"] in scores:
                scores[hit["id"]].score += 1.0 / (K + rank + 1)
            else:
                scores[hit["id"]] = Retrieved(
                    text=hit["text"], file=hit["meta"]["file"],
                    section=hit["meta"]["section"], score=1.0 / (K + rank + 1))
        ranked = sorted(scores.values(), key=lambda r: -r.score)
        return ranked[:final_top]

    def _bm25(self, collection: str, query: str, *, top: int) -> list[dict]:
        # 取全量文档做内存 BM25(个人资料量级足够;量大时再迁移)。
        col = self.store._col(collection)
        docs = col.get() or {}
        if not docs.get("ids"):
            return []
        corpus = [_tokenize(t) for t in docs["documents"]]
        bm25 = BM25Okapi(corpus)
        scores = bm25.get_scores(_tokenize(query))
        order = sorted(range(len(corpus)), key=lambda i: -scores[i])[:top]
        return [{"id": docs["ids"][i], "text": docs["documents"][i],
                 "meta": docs["metadatas"][i], "bm25": scores[i]} for i in order if scores[i] > 0]
