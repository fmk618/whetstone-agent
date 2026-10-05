# 文档加载:PyMuPDF(PDF→Markdown)+ MD 直读(方案 7.1)
from __future__ import annotations

import pymupdf as fitz  # PyMuPDF 新 API


class ParseError(Exception):
    pass


def is_likely_scanned(pdf_path: str) -> bool:
    """启发式:整份 PDF 的可提取文本极少,提示扫描件(第一版无 OCR)。"""
    with fitz.open(pdf_path) as doc:
        text_chars = sum(len(page.get_text("text")) for page in doc)
        page_count = doc.page_count
    return text_chars < 50 * max(1, page_count)


def load_markdown_from_pdf(pdf_path: str) -> str:
    """PDF 先转 Markdown 再切块(方案第 3 节)。"""
    parts: list[str] = []
    with fitz.open(pdf_path) as doc:
        for page in doc:
            parts.append(page.get_text("text"))
    text = "\n\n".join(parts).strip()
    if not text:
        raise ParseError("PDF 未提取到文本,可能是扫描件(当前版本无 OCR)")
    return text


def load_file(path: str, *, suffix: str | None = None) -> str:
    """统一入口:返回 Markdown 文本。"""
    suffix = (suffix or path.rsplit(".", 1)[-1]).lower()
    if suffix == "pdf":
        return load_markdown_from_pdf(path)
    if suffix in {"md", "markdown", "txt"}:
        return open(path, encoding="utf-8", errors="replace").read()
    raise ParseError(f"不支持的文件类型: .{suffix}")
