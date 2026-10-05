# P0 命令行验收:一条命令跑通"入库→抽取→带出处问答"
# 用法:
#   cd backend
#   uv run --python 3.11 python -m scripts.p0_check path/to/简历.pdf
#   uv run --python 3.11 python -m scripts.p0_check path/to/笔记.md
# 首次云端调用会提示知情确认(隐私策略)。
from __future__ import annotations

import asyncio
import hashlib
import sys
from pathlib import Path

from src.config import settings
from src.db import Database
from src.ingest.chunker import chunk_markdown
from src.ingest.loaders import is_likely_scanned, load_file
from src.ingest.profile import default_sensitivity, detect_sensitivities
from src.llm.base import ChatMessage
from src.llm.registry import get_registry
from src.retrieval.store import VectorStore

CONFIRM_TMPL = (
    "\n⚠ 该文档检测到敏感信息 {hits},敏感级别 {sens}。\n"
    "  即将发送给云端厂商 [{provider}](默认路由),请确认其隐私条款。\n"
    "发送?(y=确认并继续 / n=中止): "
)


async def main(path: str, question: str = "这份资料的主人有哪些主要经历与成果?") -> None:
    file = Path(path)
    if not file.exists():
        print(f"文件不存在: {path}")
        sys.exit(1)

    db = Database()
    registry = get_registry()
    router = __import__("src.llm.router", fromlist=["Router"]).Router(registry)
    store = VectorStore()

    text = load_file(str(file))
    doc_id = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    suffix = file.suffix.lstrip(".")

    scanned = is_likely_scanned(str(file)) if suffix == "pdf" else None
    if scanned:
        print("⚠ 该 PDF 疑似扫描件,未提取到文本,当前版本无 OCR。")
        sys.exit(2)

    hits = detect_sensitivities(text)
    sensitivity = default_sensitivity(hits)
    print(f"文档: {file.name}  doc_id={doc_id}")
    print(f"敏感检测: {hits or '无'}  →  敏感级别: {sensitivity}")

    # 嵌入路由:local_only 内容需知情确认
    route = router.route("embed", sens_confirmed=False) if not _needs_confirm(sensitivity) \
        else _confirm_embed(router, sensitivity, hits)
    provider = registry.get(route.provider_id)
    assert provider is not None

    if store.needs_rebuild("personal", route.provider_id, route.model,
                           len((await provider.embed(["t"], model=route.model))[0])):
        print("⚠ 嵌入模型已更换,需要重建索引(先清空后重入)。")
        store.rebuild_collection("personal", route.provider_id, route.model, 0)

    chunks = chunk_markdown(text, file=file.name)
    embeddings = await provider.embed([c.text for c in chunks], model=route.model)
    store.add("personal", chunks, embeddings, embed_provider=route.provider_id,
              embed_model=route.model, doc_id=doc_id, sensitivity=sensitivity)
    db.exec(
        "INSERT OR REPLACE INTO documents (id, filename, doc_type, sensitivity, sens_hits, n_chunks)"
        " VALUES (?,?,?,?,?,?)",
        (doc_id, file.name, "resume", sensitivity, str(hits), len(chunks)))
    print(f"✓ 已入库 {len(chunks)} 块(嵌入: {route.provider_id}/{route.model})")

    # 带出处问答
    print(f"\n问题: {question}")
    q_vec = (await provider.embed([question], model=route.model))[0]
    from src.retrieval.hybrid import HybridRetriever
    retrieved = HybridRetriever(store).search("personal", question, q_vec)
    context = "\n\n".join(f"[{r.file} > {r.section}]\n{r.text}" for r in retrieved)
    messages = [
        ChatMessage(role="system",
                    content="根据给定资料回答,每个结论后标注出处(文件>章节)。"
                            "资料不足以回答时明确说'资料不足'。"),
        ChatMessage(role="user", content=f"资料:\n{context}\n\n问题: {question}"),
    ]
    answer = await router.chat("generate", messages, sens_confirmed=True)
    print("\n—— 回答(流式省略,以下为完整结果)——")
    print(answer)
    print("\n—— 引用片段 ——")
    for r in retrieved:
        print(f"· {r.file} > {r.section}  (score={r.score:.4f})")


def _needs_confirm(sensitivity: str) -> bool:
    return sensitivity == "local_only"


def _confirm_embed(router, sensitivity, hits):
    print(CONFIRM_TMPL.format(hits=hits, sens=sensitivity,
                              provider=router.route("embed").provider_id), end="")
    if input().strip().lower() != "y":
        print("已中止。")
        sys.exit(0)
    return router.route("embed", sens_confirmed=True)


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else ""
    q = sys.argv[2] if len(sys.argv) > 2 else "这份资料的主人有哪些主要经历与成果?"
    asyncio.run(main(p, q))
