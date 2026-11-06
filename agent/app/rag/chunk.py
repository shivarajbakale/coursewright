"""Structure-first markdown chunking: split on headings, then by size, never inside a code fence."""

from __future__ import annotations

import re
from dataclasses import dataclass

MAX_CHARS = 3200  # ~800 tokens
OVERLAP_CHARS = 480  # ~120 tokens

_HEADING = re.compile(r"^(#{1,4})\s+(.*)$")


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9\s-]", "", text.lower())
    return re.sub(r"[\s-]+", "-", s).strip("-")


@dataclass
class Chunk:
    position: int
    anchor: str | None
    heading: str
    text: str


def _blocks(md: str) -> list[str]:
    """Paragraph-level blocks; a fenced code block is always one block."""
    blocks, buf, in_fence = [], [], False
    for line in md.splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
            buf.append(line)
            if not in_fence:
                blocks.append("\n".join(buf))
                buf = []
            continue
        if in_fence:
            buf.append(line)
            continue
        if not line.strip():
            if buf:
                blocks.append("\n".join(buf))
                buf = []
        else:
            buf.append(line)
    if buf:
        blocks.append("\n".join(buf))
    return blocks


def _sections(md: str) -> list[tuple[str, str | None, str]]:
    """[(heading, anchor, body)] split on h1-h4 outside code fences."""
    sections: list[tuple[str, str | None, list[str]]] = [("", None, [])]
    in_fence = False
    for line in md.splitlines():
        if line.strip().startswith("```"):
            in_fence = not in_fence
        m = None if in_fence else _HEADING.match(line)
        if m:
            heading = m.group(2).strip()
            sections.append((heading, slugify(heading), [line]))
        else:
            sections[-1][2].append(line)
    return [(h, a, "\n".join(b).strip()) for h, a, b in sections if "\n".join(b).strip()]


def chunk_markdown(md: str) -> list[Chunk]:
    from app.inkling import strip_fences

    md = strip_fences(md)  # the tutor searches the words; an explainer's source is drawing syntax
    out: list[Chunk] = []
    for heading, anchor, body in _sections(md):
        # Fold tiny heading-only sections (e.g. an h1 title) into the next one by keeping them small chunks.
        if len(body) <= MAX_CHARS:
            out.append(Chunk(len(out), anchor, heading, body))
            continue
        current: list[str] = []
        size = 0
        for block in _blocks(body):
            if size + len(block) > MAX_CHARS and current:
                out.append(Chunk(len(out), anchor, heading, "\n\n".join(current)))
                # overlap: carry trailing blocks up to OVERLAP_CHARS (skip code blocks)
                carry: list[str] = []
                csize = 0
                for b in reversed(current):
                    if b.startswith("```") or csize + len(b) > OVERLAP_CHARS:
                        break
                    carry.insert(0, b)
                    csize += len(b)
                current, size = carry, csize
            current.append(block)
            size += len(block) + 2
        if current:
            out.append(Chunk(len(out), anchor, heading, "\n\n".join(current)))
    # Merge a chunk that is only a title line into its successor.
    merged: list[Chunk] = []
    for c in out:
        if merged and len(merged[-1].text) < 120 and merged[-1].text.lstrip().startswith("#") and "\n" not in merged[-1].text.strip():
            prev = merged.pop()
            c = Chunk(c.position, c.anchor, c.heading, prev.text + "\n\n" + c.text)
        merged.append(c)
    for i, c in enumerate(merged):
        c.position = i
    return merged
