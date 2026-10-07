# 文档管理:上传(敏感检测→切块→嵌入→入库)/ 列表 / 删除 / 重建索引 / 能力画像(方案 7.1)
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .deps import Database
from . import deps
from ..config import settings
from ..ingest.chunker import chunk_markdown
from ..ingest.loaders import ParseError, is_likely_scanned, load_file
from ..ingest.profile import default_sensitivity, detect_sensitivities, extract_profile
from ..llm.router import Router
from ..retrieval.store import VectorStore

router = APIRouter(prefix="/docs", tags=["docs"])

DocType = Literal["resume", "project", "notes", "jd", "reference"]
COLLECTIONS = ("personal", "reference")

# raw 落盘文件与 mtime 记录(增量上传判断"同 hash 且同 mtime 跳过")。
# documents 表没有 mtime 列且本任务不改 db.py,这里用独立小表补齐。
_DOC_META_DDL = """
CREATE TABLE IF NOT EXISTS doc_meta (
  doc_id TEXT PRIMARY KEY,
  raw_path TEXT NOT NULL,
  mtime REAL
)
"""


# -- 依赖提供者(模块级函数,测试可直接 monkeypatch) ---------------------------

_store: VectorStore | None = None


def get_store() -> VectorStore:
    global _store
    if _store is None:
        _store = VectorStore(settings.vectorstore_dir)
    return _store


def get_router() -> Router:
    # 调用时经模块属性取 get_registry,便于测试替换 Registry 指向
    from ..llm import registry as registry_mod
    return Router(registry_mod.get_registry())


# -- 内部工具 ---------------------------------------------------------------

def _raw_file_for(db: Database, doc_id: str) -> Path | None:
    """定位某文档的原始文件:优先 doc_meta 记录,退回 raw/ 目录按前缀找。"""
    row = db.one("SELECT raw_path FROM doc_meta WHERE doc_id=?", (doc_id,))
    if row:
        p = Path(row["raw_path"])
        if p.exists():
            return p
    for p in settings.raw_dir.glob(f"{doc_id}.*"):
        return p
    return None


def _delete_doc_vectors(store: VectorStore, doc_id: str) -> None:
    """按 doc_id 删除该文档在所有集合里的向量(chroma where 过滤)。"""
    for collection in COLLECTIONS:
        col = store._col(collection)
        col.delete(where={"doc_id": doc_id})


def _collection_for(doc_type: str) -> str:
    return "reference" if doc_type == "reference" else "personal"


_PROFILE_DOC_TYPES = {"resume", "project", "notes"}


async def _extract_profile_for_doc(db: Database, rt: Router, doc_id: str, *, confirm_cloud: bool) -> dict:
    row = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    if row is None:
        raise HTTPException(status_code=404, detail="文档不存在")
    if row["doc_type"] not in _PROFILE_DOC_TYPES:
        return {"doc_id": doc_id, "competencies": 0, "claims": 0, "skipped": True}

    raw = _raw_file_for(db, doc_id)
    if raw is None:
        raise ValueError("找不到文档原文件,请重新上传")
    text = load_file(str(raw), suffix=raw.suffix.lstrip("."))
    hits = json.loads(row["sens_hits"] or "{}")
    decision = rt.route(
        "extract",
        sens_confirmed=confirm_cloud,
        sens_markers=list(hits),
    )
    provider = rt.registry.get(decision.provider_id)
    if provider is None:
        raise ValueError(f"路由指向的厂商不存在: {decision.provider_id}")
    result = await extract_profile(provider, decision.model, text, file=row["filename"])

    db.exec("DELETE FROM profile_claims WHERE doc_id=?", (doc_id,))
    claim_count = 0
    for competency in result.competencies:
        for claim in competency.claims:
            source = claim.source or {}
            db.exec(
                """INSERT INTO profile_claims
                   (doc_id, competency, ctype, domain, claim_text, strength, source_file, source_section)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    doc_id,
                    competency.competency,
                    competency.type,
                    competency.domain,
                    claim.text,
                    claim.evidence_strength,
                    source.get("file") or row["filename"],
                    source.get("section"),
                ),
            )
            claim_count += 1
    return {
        "doc_id": doc_id,
        "competencies": len(result.competencies),
        "claims": claim_count,
        "skipped": False,
    }


def _doc_row(row) -> dict:
    out = dict(row)
    for field in ("sens_hits", "embedded_json"):
        if out.get(field):
            try:
                out[field] = json.loads(out[field])
            except (json.JSONDecodeError, TypeError):
                pass
    return out


# -- 路由 -------------------------------------------------------------------

@router.post("/upload")
async def upload(
    file: Annotated[UploadFile, File()],
    doc_type: Annotated[DocType, Form()],
    sensitivity: Annotated[Literal["local_only", "cloud_ok"] | None, Form()] = None,
    confirm_cloud: bool = False,
) -> dict:
    db = deps.get_db()
    store = get_store()
    rt = get_router()

    payload = await file.read()
    if not payload:
        raise ValueError("上传文件为空")
    doc_id = hashlib.sha256(payload).hexdigest()
    filename = file.filename or f"{doc_id}.md"
    suffix = Path(filename).suffix.lower()
    path = settings.raw_dir / f"{doc_id}{suffix}"

    settings.raw_dir.mkdir(parents=True, exist_ok=True)  # tmp/data_dir 需补建
    db.exec(_DOC_META_DDL)
    existing = db.one("SELECT * FROM documents WHERE id=?", (doc_id,))
    prev_meta = db.one("SELECT mtime FROM doc_meta WHERE doc_id=?", (doc_id,))
    # 同 hash 且 raw 文件自上次入库后未改动(mtime 一致)→ 跳过重复切块/嵌入
    if existing is not None and prev_meta is not None and prev_meta["mtime"] is not None \
            and path.exists() \
            and abs(os.path.getmtime(path) - prev_meta["mtime"]) < 1e-6:
        return {
            "doc_id": doc_id, "filename": existing["filename"],
            "n_chunks": existing["n_chunks"], "sensitivity": existing["sensitivity"],
            "sens_hits": json.loads(existing["sens_hits"]) if existing["sens_hits"] else {},
            "scanned": None, "skipped": True,
        }

    path.write_bytes(payload)
    mtime = os.path.getmtime(path)

    try:
        text = load_file(str(path), suffix=suffix.lstrip("."))
    except ParseError as exc:
        path.unlink(missing_ok=True)
        raise ValueError(f"无法解析上传的文件: {exc}") from exc  # → main 统一 400
    scanned: bool | None = None
    if suffix == ".pdf":
        scanned = is_likely_scanned(str(path))  # 扫描件提示(第一版无 OCR)

    hits = detect_sensitivities(text)
    if sensitivity is None:
        sensitivity = default_sensitivity(hits)

    sens_markers = list(hits) if sensitivity == "local_only" else []
    chunks = chunk_markdown(text, file=filename)

    if chunks:
        # 路由检查(可能抛 PrivacyNotConfirmed,由 main 统一转 409)
        decision = rt.route(
            "embed",
            sens_confirmed=confirm_cloud,
            sens_markers=sens_markers,
        )
        embeddings = await rt.embed(
            [c.text for c in chunks],
            sens_confirmed=confirm_cloud,
            sens_markers=sens_markers,
        )
        collection = _collection_for(doc_type)
        _delete_doc_vectors(store, doc_id)  # 重建前先清掉旧向量,避免块数变少留尾巴
        store.add(collection, chunks, embeddings,
                  embed_provider=decision.provider_id, embed_model=decision.model,
                  doc_id=doc_id, sensitivity=sensitivity)
        embedded = {"provider": decision.provider_id, "model": decision.model,
                    "dim": len(embeddings[0]) if embeddings else 0}
    else:
        _delete_doc_vectors(store, doc_id)
        embedded = None

    db.exec(
        """INSERT INTO documents (id, filename, doc_type, sensitivity, sens_hits,
                                  n_chunks, embedded_json)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             filename=excluded.filename, doc_type=excluded.doc_type,
             sensitivity=excluded.sensitivity, sens_hits=excluded.sens_hits,
             n_chunks=excluded.n_chunks, embedded_json=excluded.embedded_json""",
        (doc_id, filename, doc_type, sensitivity,
         json.dumps(hits, ensure_ascii=False), len(chunks),
         json.dumps(embedded, ensure_ascii=False) if embedded else None),
    )
    db.exec(
        """INSERT INTO doc_meta (doc_id, raw_path, mtime) VALUES (?, ?, ?)
           ON CONFLICT(doc_id) DO UPDATE SET
             raw_path=excluded.raw_path, mtime=excluded.mtime""",
        (doc_id, str(path), mtime),
    )

    return {
        "doc_id": doc_id, "filename": filename, "n_chunks": len(chunks),
        "sensitivity": sensitivity, "sens_hits": hits, "scanned": scanned,
        "skipped": False,
    }


@router.get("")
def list_documents() -> list[dict]:
    db = deps.get_db()
    rows = db.query("SELECT * FROM documents ORDER BY created_at DESC, id")
    return [_doc_row(r) for r in rows]


@router.delete("/{doc_id}")
def delete_document(doc_id: str) -> dict:
    db = deps.get_db()
    store = get_store()

    row = db.one("SELECT id FROM documents WHERE id=?", (doc_id,))
    if row is None:
        raise HTTPException(status_code=404, detail=f"文档不存在: {doc_id}")

    raw = _raw_file_for(db, doc_id)
    db.exec("DELETE FROM documents WHERE id=?", (doc_id,))  # profile_claims 级联
    db.exec("DELETE FROM doc_meta WHERE doc_id=?", (doc_id,))
    _delete_doc_vectors(store, doc_id)
    if raw is not None:
        raw.unlink(missing_ok=True)
    return {"deleted": doc_id}


@router.post("/reindex")
async def reindex(confirm_cloud: bool = False) -> dict:
    """重建索引:检查嵌入模型绑定,需要则重建集合并重嵌入全部已入库文档。"""
    db = deps.get_db()
    store = get_store()
    rt = get_router()
    db.exec(_DOC_META_DDL)

    rows = db.query("SELECT * FROM documents")
    if not rows:
        return {"rebuilt": [], "docs": 0, "n_chunks": 0}

    decision = rt.route("embed", sens_confirmed=confirm_cloud)

    prepared: list[tuple[dict, list, list[list[float]] | None]] = []
    dim: int | None = None
    for row in rows:
        path = _raw_file_for(db, row["id"])
        if path is None:
            continue
        try:
            text = load_file(str(path))
        except ParseError:
            continue  # 扫描件等无法解析的跳过
        chunks = chunk_markdown(text, file=row["filename"])
        vectors = None
        if chunks:
            vectors = await rt.embed([c.text for c in chunks], sens_confirmed=confirm_cloud)
            dim = dim or len(vectors[0])
        prepared.append((dict(row), chunks, vectors))

    rebuilt: list[str] = []
    if dim:
        for collection in COLLECTIONS:
            if store.needs_rebuild(collection, decision.provider_id, decision.model, dim):
                store.rebuild_collection(collection, decision.provider_id, decision.model, dim)
                rebuilt.append(collection)

    total = 0
    for row, chunks, vectors in prepared:
        collection = _collection_for(row["doc_type"])
        if collection not in rebuilt:
            _delete_doc_vectors(store, row["id"])  # 未重建的集合清掉旧块再重插
        if chunks and vectors:
            store.add(collection, chunks, vectors,
                      embed_provider=decision.provider_id, embed_model=decision.model,
                      doc_id=row["id"], sensitivity=row["sensitivity"])
        db.exec(
            "UPDATE documents SET n_chunks=?, embedded_json=? WHERE id=?",
            (len(chunks),
             json.dumps({"provider": decision.provider_id, "model": decision.model,
                         "dim": dim or 0}, ensure_ascii=False) if chunks else None,
             row["id"]),
        )
        total += len(chunks)
    return {"rebuilt": rebuilt, "docs": len(prepared), "n_chunks": total}


@router.post("/{doc_id}/profile/extract")
async def extract_document_profile(doc_id: str, confirm_cloud: bool = False) -> dict:
    """从已入库的简历、项目或笔记中提取能力声明。"""
    db = deps.get_db()
    return await _extract_profile_for_doc(
        db,
        get_router(),
        doc_id,
        confirm_cloud=confirm_cloud,
    )


@router.get("/{doc_id}/profile")
def get_profile(doc_id: str) -> list[dict]:
    db = deps.get_db()
    row = db.one("SELECT id FROM documents WHERE id=?", (doc_id,))
    if row is None:
        raise HTTPException(status_code=404, detail=f"文档不存在: {doc_id}")
    claims = db.query("SELECT * FROM profile_claims WHERE doc_id=? ORDER BY id", (doc_id,))
    return [dict(r) for r in claims]
