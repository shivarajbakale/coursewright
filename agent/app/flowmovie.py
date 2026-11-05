"""Flowmovie check and storyboard, by running the vendored engine (agent/vendor/flowmovie/, MIT) under Node.

`check(source)` runs `node check.mjs <tmp>.flow` and parses its `file:line: error|warning [code]: message`
lines. `story(source)` runs `node story.mjs`. Both use a temp file, a timeout, and never raise: when Node is
missing or times out the result says so (`ok: False` with one error).
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from app import config

VENDOR_DIR = config.AGENT_DIR / "vendor" / "flowmovie"
TIMEOUT_SECONDS = 20

_LINE = re.compile(r"^(?P<file>.+?):(?P<line>\d+): (?P<kind>error|warning)(?: \[(?P<code>[\w-]+)\])?: (?P<msg>.*)$")


def node_bin() -> str | None:
    return os.environ.get("CW_NODE_BIN") or shutil.which("node")


def _run(script: str, source: str) -> tuple[int, str]:
    node = node_bin()
    if not node:
        return 127, "node is not installed, so Flowmovie movies can't be checked"
    with tempfile.TemporaryDirectory(prefix="cw-flow-") as d:
        path = Path(d) / "movie.flow"
        path.write_text(source)
        try:
            p = subprocess.run(
                [node, str(VENDOR_DIR / script), str(path)],
                capture_output=True,
                text=True,
                timeout=TIMEOUT_SECONDS,
                cwd=d,
            )
        except subprocess.TimeoutExpired:
            return 124, f"Flowmovie {script} timed out after {TIMEOUT_SECONDS}s"
        out = (p.stdout + ("\n" + p.stderr if p.stderr.strip() else "")).replace(str(path), "movie.flow")
        return p.returncode, out.strip()


def check(source: str) -> dict:
    """{"ok": bool, "errors": [{"line", "message"}], "warnings": [{"line", "code", "message"}], "summary": str}"""
    code, out = _run("check.mjs", source)
    errors: list[dict] = []
    warnings: list[dict] = []
    summary = ""
    for ln in out.splitlines():
        m = _LINE.match(ln)
        if m:
            item = {"line": int(m["line"]), "message": m["msg"].strip()}
            if m["kind"] == "error":
                errors.append(item)
            else:
                warnings.append({**item, "code": m["code"] or ""})
        elif ln.startswith("movie.flow: "):
            summary = ln[len("movie.flow: "):]
    ok = code == 0
    if not ok and not errors:
        errors.append({"line": 0, "message": out or f"check failed (exit {code})"})
    return {"ok": ok, "errors": errors, "warnings": warnings, "summary": summary or out[-300:]}


def story(source: str) -> str:
    _code, out = _run("story.mjs", source)
    return out


def format_check(result: dict) -> str:
    """Human/LLM-readable form of `check()`."""
    lines = [("OK: " if result["ok"] else "FAILED: ") + result["summary"]]
    for e in result["errors"]:
        lines.append(f"line {e['line']}: error: {e['message']}")
    for w in result["warnings"]:
        lines.append(f"line {w['line']}: warning [{w['code']}]: {w['message']}")
    return "\n".join(lines)


_TITLE = re.compile(r"^\s*title\s+(.+?)\s*$", re.M)
_MMD_TITLE = re.compile(r"^\s*%%\s*title:\s*(.+?)\s*$", re.M)


def flow_title(source: str) -> str:
    m = _TITLE.search(source)
    return m.group(1) if m else ""


def mermaid_title(source: str) -> str:
    m = _MMD_TITLE.search(source)
    return m.group(1) if m else ""


MERMAID_KINDS = (
    "flowchart", "graph", "sequenceDiagram", "stateDiagram", "stateDiagram-v2", "classDiagram", "erDiagram",
    "gantt", "pie", "mindmap", "timeline", "journey", "gitGraph", "quadrantChart", "block-beta",
)


def mermaid_problem(source: str) -> str | None:
    """A cheap sanity check (no Mermaid parser in Python): the first real line names a diagram type."""
    for ln in source.splitlines():
        s = ln.strip()
        if not s or s.startswith("%%") or s == "---":
            continue
        if s.split()[0] in MERMAID_KINDS:
            return None
        return f"Mermaid source must start with a diagram type ({', '.join(MERMAID_KINDS[:6])}, ...), got: {s[:60]}"
    return "Mermaid source is empty"
