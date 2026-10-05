# 入库单测:切块、敏感检测、加载器
from __future__ import annotations

import pytest

from src.ingest.chunker import chunk_markdown
from src.ingest.loaders import load_file, is_likely_scanned, load_markdown_from_pdf
from src.ingest.profile import default_sensitivity, detect_sensitivities

MD = """# 张三的简历

## 工作经历

负责华东大客户,年度业绩 1200 万。

### 项目一

上线了客户管理系统。

## 教育背景

某某大学 本科。
"""


def test_chunk_preserves_section_path():
    chunks = chunk_markdown(MD, file="resume.md")
    sections = {c.section for c in chunks}
    # 章节路径为完整层级:"H1 > H2(> H3)"
    assert "张三的简历 > 工作经历" in sections
    assert "张三的简历 > 工作经历 > 项目一" in sections
    assert "张三的简历 > 教育背景" in sections
    # 每块都带文件名
    assert all(c.file == "resume.md" for c in chunks)


def test_chunk_respects_max_len():
    long_md = "# T\n\n" + ("很长的段落。" * 400)
    chunks = chunk_markdown(long_md, file="f.md", max_chars=500, min_chars=50)
    # 单段超过 max_chars 时允许整段保留(_split_long 兜底),但不会无界膨胀
    assert len(chunks) > 1
    assert max(len(c.text) for c in chunks) <= 3000


def test_detect_sensitivities_phone_and_email():
    text = "联系我:13812345678,邮箱 me@example.com,身份证 11010119900307777X"
    hits = detect_sensitivities(text)
    assert hits.get("phone") == 1
    assert hits.get("email") == 1
    assert hits.get("id_card") == 1


def test_detect_no_false_positive_on_metrics():
    hits = detect_sensitivities("年度业绩 1200 万,同比增长 40%")
    assert "bank_card" not in hits


def test_default_sensitivity():
    assert default_sensitivity({"phone": 2}) == "local_only"
    assert default_sensitivity({}) == "cloud_ok"


def test_load_md(tmp_path):
    f = tmp_path / "note.md"
    f.write_text("# 笔记\n内容", encoding="utf-8")
    assert load_file(str(f)).startswith("# 笔记")


def test_load_unsupported(tmp_path):
    f = tmp_path / "x.docx"
    f.write_text("x", encoding="utf-8")
    with pytest.raises(Exception):
        load_file(str(f))


def test_scanned_pdf_detection(tmp_path):
    import pymupdf
    p = tmp_path / "empty.pdf"
    doc = pymupdf.open()
    doc.new_page()
    doc.save(str(p))
    doc.close()
    assert is_likely_scanned(str(p))
    with pytest.raises(Exception, match="扫描件"):
        load_markdown_from_pdf(str(p))
