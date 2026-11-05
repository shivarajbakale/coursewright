"""review_project job: fetch a public GitHub repo through the REST API (no clone), review it with Claude
against the milestone and rubric, store findings tagged pass / fix / idea with chapter links."""

from __future__ import annotations

import asyncio
import base64
import re
from typing import Literal

import httpx
from pydantic import BaseModel

from app import config
from app.db import db, jdump, jload, new_id, now, row, rows
from app.jobs import store

MAX_FILES = 25
MAX_FILE_CHARS = 12000
MAX_TOTAL_CHARS = 120000
CODE_EXT = re.compile(
    r"\.(go|py|rs|ts|tsx|js|jsx|java|kt|c|cc|cpp|h|hpp|rb|ex|exs|scala|cs|swift|zig|ml|hs|clj|toml|mod|md|txt|yaml|yml|json)$"
)
SKIP = re.compile(r"(^|/)(node_modules|vendor|dist|build|target|\.git|__pycache__|\.venv)/|lock(\.json)?$|\.min\.")


class Finding(BaseModel):
    kind: Literal["pass", "fix", "idea"]
    title: str
    body: str
    chapterId: str | None


class Review(BaseModel):
    findings: list[Finding]


def mark_failed(job: dict, msg: str) -> None:
    sid = jload(job["input"], {}).get("submissionId")
    if sid:
        with db() as conn:
            conn.execute("UPDATE submissions SET status='failed', error=? WHERE id=?", (msg, sid))


def _repo_parts(url: str) -> tuple[str, str]:
    m = re.match(r"^https?://(?:www\.)?github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$", url.strip())
    if not m:
        raise ValueError("not a GitHub repository URL")
    return m.group(1), m.group(2)


def _rank(path: str, focus: str) -> tuple:
    p = path.lower()
    score = 0
    if focus and any(w in p for w in re.findall(r"\w{3,}", focus.lower())):
        score -= 5
    if "test" in p:
        score -= 1
    if p.endswith(("readme.md", "go.mod", "pyproject.toml", "cargo.toml", "package.json")):
        score -= 3
    return (score, p.count("/"), len(p))


async def fetch_repo(url: str, focus: str = "") -> tuple[list[str], dict[str, str]]:
    owner, repo = _repo_parts(url)
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "Coursewright/0.1"}
    if config.github_token():
        headers["Authorization"] = f"Bearer {config.github_token()}"
    async with httpx.AsyncClient(base_url="https://api.github.com", headers=headers, timeout=30) as gh:
        meta = await gh.get(f"/repos/{owner}/{repo}")
        if meta.status_code == 404:
            raise RuntimeError("Repository not found (is it public?)")
        meta.raise_for_status()
        branch = meta.json().get("default_branch", "main")
        tree = await gh.get(f"/repos/{owner}/{repo}/git/trees/{branch}", params={"recursive": "1"})
        tree.raise_for_status()
        paths = [t["path"] for t in tree.json().get("tree", []) if t.get("type") == "blob"]
        candidates = sorted(
            [p for p in paths if CODE_EXT.search(p) and not SKIP.search(p)], key=lambda p: _rank(p, focus)
        )[:MAX_FILES]
        files: dict[str, str] = {}
        total = 0
        for p in candidates:
            r = await gh.get(f"/repos/{owner}/{repo}/contents/{p}", params={"ref": branch})
            if r.status_code != 200:
                continue
            data = r.json()
            if data.get("encoding") != "base64":
                continue
            text = base64.b64decode(data.get("content", "")).decode("utf-8", errors="replace")[:MAX_FILE_CHARS]
            if total + len(text) > MAX_TOTAL_CHARS:
                break
            files[p] = text
            total += len(text)
    return paths, files


async def run(job: dict) -> dict:
    from app.agents.llm import parse, require_key

    job_id = job["id"]
    sid = jload(job["input"], {}).get("submissionId")
    with db() as conn:
        sub = row(conn, "SELECT * FROM submissions WHERE id=?", (sid,))
        if not sub:
            raise RuntimeError("submission not found")
        conn.execute("UPDATE submissions SET status='running' WHERE id=?", (sid,))
        p = row(conn, "SELECT * FROM projects WHERE id=?", (sub["project_id"],))
        ms = row(conn, "SELECT * FROM milestones WHERE id=?", (sub["milestone_id"],)) if sub["milestone_id"] else None
        chapters = rows(
            conn,
            """SELECT ch.id, ch.title FROM chapters ch JOIN modules m ON m.id=ch.module_id
               WHERE ch.course_id=? ORDER BY m.position, ch.position""",
            (p["course_id"],),
        )
    require_key()
    store.emit(job_id, "research", "Fetching the repository", {"terms": [sub["repo_url"]]})
    tree, files = await fetch_repo(sub["repo_url"], sub["focus"])
    store.check_cancel(job_id)
    store.emit(job_id, "research", f"Read {len(files)} of {len(tree)} files", {"files": list(files)})

    chapter_ids = {c["id"] for c in chapters}
    parts = [
        f"# Project: {p['title']}\n\n{p['brief']}",
        "## Rubric\n" + "\n".join(f"- {r['criterion']} (chapterId: {r.get('chapterId')})" for r in jload(p["rubric"], [])),
        "## Chapters\n" + "\n".join(f"- {c['id']}: {c['title']}" for c in chapters),
    ]
    if ms:
        parts.append(f"## Milestone {ms['position']}: {ms['title']}\n\n{ms['body']}\n\nCheck command: `{ms['check_cmd']}`")
    if sub["focus"]:
        parts.append(f"## The learner asks you to focus on\n{sub['focus']}")
    parts.append("## File tree\n" + "\n".join(tree[:400]))
    parts.append("## Files\n" + "\n\n".join(f"### {path}\n```\n{text}\n```" for path, text in files.items()))

    review, usage = await parse(
        system=config.prompt("reviewer_project"),
        user="\n\n".join(parts),
        schema=Review,
        effort="high",
        max_tokens=16000,
    )
    findings = [
        {**f.model_dump(), "chapterId": f.chapterId if f.chapterId in chapter_ids else None} for f in review.findings
    ]

    def save() -> None:
        with db() as conn:
            conn.execute(
                "INSERT INTO reviews(id, submission_id, findings, created_at) VALUES (?,?,?,?)",
                (new_id(), sid, jdump(findings), now()),
            )
            conn.execute("UPDATE submissions SET status='done', error=NULL WHERE id=?", (sid,))

    await asyncio.to_thread(save)
    store.set_usage(job_id, usage["inputTokens"], usage["outputTokens"])
    store.emit(job_id, "done", f"{len(findings)} findings", {"submissionId": sid})
    return {"findings": len(findings)}
