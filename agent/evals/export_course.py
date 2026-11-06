"""Export a course from a running Coursewright API into the builder's folder shape, so the teaching and
builder evals can grade a course that was built elsewhere (for example the deployed one, as a baseline).

    uv run python -m evals.export_course <base url> <course id> <out folder>

Chapters lose their concept tags (the API doesn't return them), so per-lesson concept counts read 0."""

from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path


def _get(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=30) as r:  # noqa: S310 - a URL the person passed in
        return json.loads(r.read())["data"]


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:40] or "x"


def export(base: str, course_id: str, out: Path) -> Path:
    base = base.rstrip("/")
    c = _get(f"{base}/api/courses/{course_id}")
    (out / "chapters").mkdir(parents=True, exist_ok=True)
    modules, n = [], 0
    for mi, m in enumerate(c["modules"], start=1):
        chapters = []
        for ch in m["chapters"]:
            n += 1
            key = f"c{n:02d}-{_slug(ch['title'])}"
            full = _get(f"{base}/api/chapters/{ch['id']}")
            (out / "chapters" / f"{key}.md").write_text(full["markdown"].strip() + "\n")
            qs = [{"prompt": q["prompt"], "options": q["options"], "answer": q["answer"],
                   "explanation": q.get("explanation", "")} for q in full.get("questions", [])]
            (out / "chapters" / f"{key}.json").write_text(json.dumps({"questions": qs}, indent=2))
            chapters.append({"key": key, "title": ch["title"], "readingMinutes": ch.get("readingMinutes", 8)})
        modules.append({"key": f"m{mi}", "title": m["title"], "summary": m.get("summary", ""), "chapters": chapters})
    outline = {"title": c["title"], "topic": c.get("topic", ""), "summary": c.get("summary", ""),
               "concepts": [], "edges": [], "modules": modules}
    (out / "outline.json").write_text(json.dumps(outline, indent=2))
    (out.parent / "brief.json").write_text(json.dumps(c.get("brief") or {}, indent=2))
    return out


if __name__ == "__main__":
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    print(export(sys.argv[1], sys.argv[2], Path(sys.argv[3])))
