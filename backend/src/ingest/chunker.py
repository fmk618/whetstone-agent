# 按 Markdown 标题层级切块;元数据保留"文件名 + 章节路径"(方案第 3 节)
from __future__ import annotations

import re
from dataclasses import dataclass

_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass
class Chunk:
    text: str
    file: str
    section: str  # 章节路径,如 "工作经历 > 华东大区"
    index: int


def chunk_markdown(md: str, *, file: str, max_chars: int = 800,
                   min_chars: int = 80) -> list[Chunk]:
    lines = md.splitlines()
    path: list[tuple[int, str]] = []  # (level, title) 栈
    chunks: list[Chunk] = []
    buf: list[str] = []

    def current_section() -> str:
        return " > ".join(t for _, t in path) if path else "(开头)"

    def flush(section: str) -> None:
        nonlocal buf
        text = "\n".join(buf).strip()
        buf = []
        if text:
            chunks.extend(_split_long(text, file, section, len(chunks), max_chars, min_chars))

    for line in lines:
        m = _HEADING.match(line)
        if m:
            level, title = len(m.group(1)), m.group(2).strip()
            flush(current_section())
            while path and path[-1][0] >= level:
                path.pop()
            path.append((level, title))
        else:
            buf.append(line)
            if sum(len(l) + 1 for l in buf) >= max_chars:
                flush(current_section())
    flush(current_section())
    return chunks


def _split_long(text: str, file: str, section: str, start_index: int,
                max_chars: int, min_chars: int) -> list[Chunk]:
    if len(text) <= max_chars:
        return [Chunk(text=text, file=file, section=section, index=start_index)]
    # 限长切段:先按段落,单段超长再按句子;保证不超过 max_chars
    paras = text.split("\n\n")
    pieces: list[str] = []
    for p in paras:
        if len(p) <= max_chars:
            pieces.append(p)
            continue
        # 无换行的超长单段:按句号/问号/叹号切,再兜底硬切
        sents, cur = [], ""
        for s in re.split(r"(?<=[。!?!?])", p):
            if len(s) > max_chars:  # 无句读的超长串,硬切
                sents.extend(s[i:i + max_chars] for i in range(0, len(s), max_chars))
            elif cur and len(cur) + len(s) > max_chars:
                sents.append(cur)
                cur = s
            else:
                cur += s
        if cur:
            sents.append(cur)
        pieces.extend(sents)

    out, cur = [], ""
    for piece in pieces:
        if cur and len(cur) + len(piece) + 2 > max_chars:
            out.append(cur.strip())
            cur = piece
        else:
            cur = f"{cur}\n\n{piece}" if cur else piece
    if cur.strip():
        out.append(cur.strip())
    return [Chunk(text=t, file=file, section=section, index=start_index + i)
            for i, t in enumerate(out)]
