"""Inkling explainers: hand-drawn diagrams written as ```inkling fences inside a lesson's markdown.

Inkling (agent/vendor/inkling/, the owner's library, vendored from ~/Projects/inkling with `npm run vendor`)
turns a few lines of text into a drawing that draws itself step by step. A lesson carries one, sometimes two,
right after the paragraph they picture. This module finds the fences, checks their source with the vendored
command line under Node (`node bin/inkling.mjs check`), and removes them where only words matter (the tutor's
search index, word counts).

Like app/flowmovie.py it never raises: when Node is missing or times out the result says so.
"""

from __future__ import annotations

import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

from app import config
from app.flowmovie import node_bin

VENDOR_DIR = config.AGENT_DIR / "vendor" / "inkling"
CLI = VENDOR_DIR / "bin" / "inkling.mjs"
TIMEOUT_SECONDS = 30
MAX_PER_LESSON = 2
LAYOUTS = ("flow", "free", "stack", "cycle", "timeline", "compare", "mindmap", "sequence")

# ```inkling [options]\n ... \n``` on lines of their own.
FENCE = re.compile(r"^```inkling\b(?P<info>[^\n]*)\n(?P<body>.*?)^```[ \t]*$", re.M | re.S)
_LINE = re.compile(r"^(?P<file>[^:\n]+):(?P<line>\d+): (?P<kind>error|warning): (?P<msg>.*?)(?: \[(?P<code>[\w-]+)\])?$")
_TITLE = re.compile(r'^\s*title\s+"(?P<t>(?:[^"\\]|\\.)*)"', re.M)
_LAYOUT = re.compile(r"^\s*layout\s+(\w+)", re.M)


@dataclass
class Fence:
    info: str
    source: str
    start: int
    end: int

    @property
    def title(self) -> str:
        return title(self.source)

    @property
    def layout(self) -> str:
        return layout(self.source)


def fences(markdown: str) -> list[Fence]:
    return [Fence(m["info"].strip(), m["body"].rstrip("\n"), m.start(), m.end()) for m in FENCE.finditer(markdown)]


def title(source: str) -> str:
    m = _TITLE.search(source)
    return m["t"].replace('\\"', '"') if m else ""


def layout(source: str) -> str:
    m = _LAYOUT.search(source)
    return m.group(1) if m and m.group(1) in LAYOUTS else "flow"


def strip_fences(markdown: str, keep_title: bool = True) -> str:
    """The lesson without its drawings; each becomes one line naming it, so the text still says one is there."""
    def repl(m: re.Match) -> str:
        t = title(m["body"])
        return f"(Diagram: {t})" if keep_title and t else ""

    return FENCE.sub(repl, markdown)


def fence(source: str) -> str:
    return f"```inkling\n{source.strip()}\n```"


# ---- checking ------------------------------------------------------------------------------------------


def check_many(sources: list[str]) -> list[dict]:
    """Check several sources with one Node run. Each result is
    {"ok", "errors": [{line, message, code}], "warnings": [...], "summary"}."""
    if not sources:
        return []
    node = node_bin()
    if not node:
        return [_failed("node is not installed, so Inkling diagrams can't be checked") for _ in sources]
    with tempfile.TemporaryDirectory(prefix="cw-ink-") as d:
        names = []
        for i, s in enumerate(sources):
            name = f"d{i}.inkling"
            (Path(d) / name).write_text(s.strip() + "\n")
            names.append(name)
        try:
            p = subprocess.run([node, str(CLI), "check", *names], capture_output=True, text=True,
                               timeout=TIMEOUT_SECONDS, cwd=d)
        except subprocess.TimeoutExpired:
            return [_failed(f"Inkling check timed out after {TIMEOUT_SECONDS}s") for _ in sources]
    out = p.stdout + "\n" + p.stderr
    results = {n: {"ok": True, "errors": [], "warnings": [], "summary": ""} for n in names}
    for ln in out.splitlines():
        m = _LINE.match(ln.strip())
        if not m or m["file"] not in results:
            continue
        item = {"line": int(m["line"]), "message": m["msg"].strip(), "code": m["code"] or ""}
        r = results[m["file"]]
        if m["kind"] == "error":
            r["errors"].append(item)
            r["ok"] = False
        else:
            r["warnings"].append(item)
    if p.returncode not in (0, 1):
        return [_failed(out.strip()[-400:] or f"Inkling check failed (exit {p.returncode})") for _ in sources]
    for r in results.values():
        r["summary"] = f"{len(r['errors'])} errors, {len(r['warnings'])} warnings"
    return [results[n] for n in names]


def check(source: str) -> dict:
    return check_many([source])[0]


def _failed(message: str) -> dict:
    return {"ok": False, "errors": [{"line": 0, "message": message, "code": ""}], "warnings": [], "summary": message}


def format_check(result: dict) -> str:
    lines = [("OK: " if result["ok"] else "FAILED: ") + result["summary"]]
    for e in result["errors"]:
        lines.append(f"line {e['line']}: error: {e['message']}" + (f" [{e['code']}]" if e["code"] else ""))
    for w in result["warnings"]:
        lines.append(f"line {w['line']}: warning: {w['message']}" + (f" [{w['code']}]" if w["code"] else ""))
    return "\n".join(lines)


_STEP = re.compile(r'^\s*step\s+(\d+)\s*:\s*(?P<names>[^"\n]*?)\s*(?:"|$)', re.M)


def empty_steps(source: str) -> list[int]:
    """Steps that bring in nothing new. A step draws the things it names that no earlier step drew (and the
    arrows whose ends are then all there); one that only names things already drawn is empty, and Inkling
    drops it with its caption."""
    seen: set[str] = set()
    empty = []
    for m in sorted(_STEP.finditer(source), key=lambda m: int(m.group(1))):
        names = {n.strip().strip('"') for n in m["names"].split(",") if n.strip()}
        if names and names <= seen:
            empty.append(int(m.group(1)))
        seen |= names
    return empty


def source_problems(source: str) -> list[str]:
    """What the house rules ask of an explainer, beyond parsing: a title, and steps that tell the story."""
    problems = []
    if not title(source):
        problems.append('give it a title line: title "<the idea in a few words>"')
    if not re.search(r"^\s*(step\s+\d+\s*:|steps\s+auto)", source, re.M):
        problems.append('add steps (step 1: names "caption" ...) or "steps auto", so it draws in the reading order')
    for n in empty_steps(source):
        problems.append(f"step {n} only names things an earlier step already drew, so it draws nothing and its caption "
                        "is lost; each step must bring in a new thing (in a sequence, use steps auto)")
    return problems


def markdown_problems(markdown: str, *, node: bool = True) -> list[str]:
    """Every problem with the explainers in a lesson, one line each, naming which explainer."""
    found = fences(markdown)
    problems = []
    if len(found) > MAX_PER_LESSON:
        problems.append(f"{len(found)} Inkling explainers; a lesson has at most {MAX_PER_LESSON}.")
    results = check_many([f.source for f in found]) if node else [None] * len(found)
    for i, (f, r) in enumerate(zip(found, results), 1):
        name = f'explainer {i}' + (f' ("{f.title}")' if f.title else "")
        for p in source_problems(f.source):
            problems.append(f"{name}: {p}")
        if r is None:
            continue
        for e in r["errors"]:
            problems.append(f"{name} line {e['line']}: {e['message']}")
        for w in r["warnings"]:  # a generated drawing is held to a clean check: a warning often loses a step
            problems.append(f"{name} line {w['line']}: {w['message']}")
    return problems
