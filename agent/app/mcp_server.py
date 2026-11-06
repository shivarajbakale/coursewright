"""Coursewright over MCP: everything a coding agent (Claude Code, Codex, Cursor, ...) needs to write a course,
check it and import it, without reading this repo.

    uv --directory agent run python -m app.mcp_server            # stdio, for a local agent

It exposes three kinds of thing:
- the rules, as tools (get_guide, get_rules, get_schema) and the same text as resources and a prompt, so a
  client that only uses tools still gets them;
- authoring tools that write a course folder under CW_COURSES_DIR (default <repo>/courses), checking each
  piece as it is saved and answering with the problems in it;
- check_course and import_course, the same check and import as `python -m app.cli`. Import goes to the local
  database, or to a running server when CW_SERVER (or the `server` argument) is set.

The folder format and the rules are docs/authoring-courses.md and app/prompts/*.md; nothing is restated here.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Literal

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import ValidationError

from app import authoring, config
from app.materialise import KEY, ChapterExtras, CourseOutline, DiagramRequest, ProjectSpec, QuestionSpec

GUIDE = config.AGENT_DIR.parent / "docs" / "authoring-courses.md"
PROMPTS = config.APP_DIR / "prompts"
# What each stage of writing follows. The builder's own prompts, so authored and built courses agree.
RULES = {
    "course_format": "Rules for everything the learner reads: explain from first principles, house style.",
    "curriculum": "Designing the outline: the floor, working backwards to concepts, one concept per lesson.",
    "writer": "Writing one lesson: shape, length, the key idea, 'What you have now'.",
    "quiz": "Writing check-yourself questions.",
    "diagrammer": "Choosing and writing a diagram: Flowmovie (.flow) for motion, Mermaid (.mmd) for structure.",
}
Stage = Literal["course_format", "curriculum", "writer", "quiz", "diagrammer"]

WORKFLOW = """Write a Coursewright course in this order. Every save tool checks what it saved and returns the
problems; fix errors before moving on, and fix warnings unless you can say why one is wrong for this lesson.

1. get_guide, then get_rules("course_format") and get_rules("curriculum").
2. start_course with the topic, goal and pace agreed with the user.
3. save_outline. Then show the user the modules and lesson titles in order and WAIT for their approval;
   reshape and save again if they ask.
4. For each lesson in order: get_rules("writer") and get_rules("quiz") once, then save_lesson with the
   markdown and 2-3 questions. A lesson may only use what earlier lessons taught.
5. Only where a moving picture shows what words cannot: get_rules("diagrammer"), then save_diagram.
6. save_project for each module that names a projectKey.
7. check_course until it reports 0 errors.
8. import_course, and give the user the course path it returns. replace=true updates a course imported
   before and drops the learner's progress on it: ask the user first."""

mcp = MCPServer(
    name="coursewright",
    title="Coursewright course authoring",
    instructions=WORKFLOW,
)


# ---- paths -------------------------------------------------------------------------------------------


def courses_dir() -> Path:
    return Path(os.environ.get("CW_COURSES_DIR") or (config.AGENT_DIR.parent / "courses"))


def _folder(slug: str, *, exists: bool = True) -> Path:
    if not re.match(KEY, slug or ""):
        raise ToolError(f'"{slug}" is not a course slug: lower-case letters, digits, "-" and "_".')
    folder = courses_dir() / slug
    if exists and not (folder / "outline.json").exists() and not (folder / "brief.json").exists():
        raise ToolError(f'No course "{slug}" in {courses_dir()}. Call start_course first.')
    return folder


def _key(key: str) -> str:
    if not re.match(KEY, key or ""):
        raise ToolError(f'"{key}" is not a key: lower-case letters, digits, "-" and "_".')
    return key


def _outline(folder: Path) -> CourseOutline:
    p = folder / "outline.json"
    if not p.exists():
        raise ToolError("This course has no outline yet. Call save_outline first.")
    return CourseOutline.model_validate(json.loads(p.read_text()))


def _issues(folder: Path, keep) -> dict:
    report = authoring.check_folder(folder)
    issues = [str(i) for i in report.issues if keep(i)]
    return {"errors": sum(1 for i in report.issues if keep(i) and i.level == "error"), "issues": issues}


def _about_lesson(key: str):
    files = {f"chapters/{key}.md", f"chapters/{key}.json", f"diagrams/{key}.flow", f"diagrams/{key}.mmd"}
    return lambda i: i.path in files or (i.path == "outline.json" and f"lesson {key}" in i.message)


def _pydantic_errors(e: ValidationError) -> list[str]:
    return [f"{'.'.join(str(p) for p in err['loc'])}: {err['msg']}" for err in e.errors()]


# ---- the rules -----------------------------------------------------------------------------------------


@mcp.tool(description="The authoring guide: the course folder, every file's shape with examples, what the check reports. Read it first.")
def get_guide() -> str:
    return GUIDE.read_text() if GUIDE.exists() else "The guide is docs/authoring-courses.md in the Coursewright repo."


@mcp.tool(description="The rules for one stage of writing, the same ones the in-app builder follows. "
          + " ".join(f"{k}: {v}" for k, v in RULES.items()))
def get_rules(stage: Stage) -> str:
    return (PROMPTS / f"{stage}.md").read_text()


@mcp.tool(description="JSON Schemas of outline.json, chapters/<key>.json and projects/<key>.json.")
def get_schema() -> dict[str, Any]:
    return authoring.schemas()


@mcp.resource("coursewright://guide", name="guide", title="Course authoring guide", mime_type="text/markdown")
def guide_resource() -> str:
    return get_guide()


for _stage, _about in RULES.items():
    def _make(stage: str):
        def read() -> str:
            return (PROMPTS / f"{stage}.md").read_text()
        return read

    mcp.resource(f"coursewright://rules/{_stage}", name=f"rules-{_stage}", description=_about,
                 mime_type="text/markdown")(_make(_stage))


@mcp.prompt(name="write-course", title="Write a Coursewright course",
            description="The whole workflow for writing a course on a topic, with the tools to call in order.")
def write_course_prompt(topic: str, goal: str = "", pace: str = "") -> str:
    brief = f"Topic: {topic}\nGoal: {goal or '(ask the user)'}\nPace: {pace or '(ask the user)'}"
    return f"Write a Coursewright course.\n\n{brief}\n\n{WORKFLOW}"


# ---- writing ---------------------------------------------------------------------------------------------


@mcp.tool(description="List the course folders being written, with how many lessons are written, and whether each passes the check.")
def list_courses() -> list[dict[str, Any]]:
    out = []
    root = courses_dir()
    for d in sorted(root.iterdir()) if root.is_dir() else []:
        if not d.is_dir():
            continue
        item: dict[str, Any] = {"slug": d.name, "hasOutline": (d / "outline.json").exists()}
        if item["hasOutline"]:
            report = authoring.check_folder(d, flow=False)
            written = len(list((d / "chapters").glob("*.md"))) if (d / "chapters").is_dir() else 0
            item.update(title=report.title, lessons=report.lessons, written=written,
                        errors=len(report.errors), warnings=len(report.warnings))
        out.append(item)
    return out


@mcp.tool(description="Start a course folder with its brief. `slug` names the folder (kebab-case).")
def start_course(slug: str, topic: str, goal: str, pace: str = "") -> dict[str, Any]:
    folder = _folder(slug, exists=False)
    if (folder / "outline.json").exists():
        raise ToolError(f'"{slug}" already has an outline; use read_course to see it, or pick another slug.')
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "brief.json").write_text(json.dumps({"topic": topic, "goal": goal, "pace": pace, "answers": []}, indent=2) + "\n")
    return {"folder": str(folder), "next": "get_rules('curriculum'), then save_outline"}


@mcp.tool(description="Save the outline (the whole outline.json object: title, topic, summary, colour, concepts, "
          "edges, modules with chapters). Refused if it doesn't match the schema; otherwise returns the outline's "
          "problems and the lessons still to write.")
def save_outline(slug: str, outline: dict[str, Any]) -> dict[str, Any]:
    folder = _folder(slug)
    try:
        parsed = CourseOutline.model_validate(outline)
    except ValidationError as e:
        return {"saved": False, "errors": _pydantic_errors(e)}
    (folder / "outline.json").write_text(parsed.model_dump_json(by_alias=True, indent=2) + "\n")
    report = authoring.check_folder(folder, flow=False)
    missing = [i.path for i in report.errors if i.message.startswith("missing: every lesson")]
    issues = [str(i) for i in report.issues if i.path == "outline.json"]
    return {"saved": True, "lessons": report.lessons, "modules": report.modules, "issues": issues,
            "lessonsToWrite": [p.removeprefix("chapters/").removesuffix(".md") for p in missing]}


@mcp.tool(description="Read a course: its brief, outline, and which lessons, diagrams and projects are written. "
          "With `lesson`, also that lesson's markdown and questions.")
def read_course(slug: str, lesson: str | None = None) -> dict[str, Any]:
    folder = _folder(slug)
    out: dict[str, Any] = {"folder": str(folder)}
    if (folder / "brief.json").exists():
        out["brief"] = json.loads((folder / "brief.json").read_text())
    if (folder / "outline.json").exists():
        out["outline"] = json.loads((folder / "outline.json").read_text())
    out["files"] = sorted(authoring.read_bundle(folder))
    if lesson:
        key = _key(lesson)
        md, side = folder / "chapters" / f"{key}.md", folder / "chapters" / f"{key}.json"
        out["lesson"] = {"markdown": md.read_text() if md.exists() else None,
                         "extras": json.loads(side.read_text()) if side.exists() else None}
    return out


@mcp.tool(description="Save one lesson: its markdown (starting '# <title from the outline>') and 2-3 questions "
          "({prompt, options, answer (0-based), explanation, conceptKeys}). Optional diagram_request "
          "({title, show, shape: process|structure}) records what a diagram should show. Returns the lesson's problems.")
def save_lesson(
    slug: str,
    key: str,
    markdown: str,
    questions: list[dict[str, Any]] | None = None,
    diagram_request: dict[str, Any] | None = None,
) -> dict[str, Any]:
    folder = _folder(slug)
    key = _key(key)
    keys = {ch.key for m in _outline(folder).modules for ch in m.chapters}
    if key not in keys:
        return {"saved": False, "errors": [f'"{key}" is not a lesson in the outline. Lessons: {sorted(keys)}']}
    try:
        extras = ChapterExtras(
            questions=[QuestionSpec.model_validate(q) for q in questions or []],
            diagramRequest=DiagramRequest.model_validate(diagram_request) if diagram_request else None,
        )
    except ValidationError as e:
        return {"saved": False, "errors": _pydantic_errors(e)}
    side = folder / "chapters" / f"{key}.json"
    if side.exists():  # keep inline diagrams saved earlier
        try:
            extras.diagrams = ChapterExtras.model_validate(json.loads(side.read_text())).diagrams
        except (ValidationError, json.JSONDecodeError):
            pass
    (folder / "chapters").mkdir(exist_ok=True)
    (folder / "chapters" / f"{key}.md").write_text(markdown.strip() + "\n")
    side.write_text(extras.model_dump_json(indent=2, exclude_none=True) + "\n")
    return {"saved": True, **_issues(folder, _about_lesson(key))}


@mcp.tool(description="Save a lesson's diagram: kind 'flow' (Flowmovie, for anything that moves) or 'mermaid' "
          "(for structure). The source is compiled first and refused with the compiler's errors if it fails.")
def save_diagram(slug: str, key: str, kind: Literal["flow", "mermaid"], source: str) -> dict[str, Any]:
    folder = _folder(slug)
    key = _key(key)
    problem = authoring._diagram_issue(kind, source, True)
    if problem:
        return {"saved": False, "errors": [problem]}
    d = folder / "diagrams"
    d.mkdir(exist_ok=True)
    ext, other = (".flow", ".mmd") if kind == "flow" else (".mmd", ".flow")
    (d / f"{key}{ext}").write_text(source.strip() + "\n")
    (d / f"{key}{other}").unlink(missing_ok=True)
    return {"saved": True, **_issues(folder, _about_lesson(key))}


@mcp.tool(description="Save a module's project (projects/<key>.json: title, brief, starter, hints, rubric, "
          "milestones). The module names it with projectKey in the outline.")
def save_project(slug: str, key: str, project: dict[str, Any]) -> dict[str, Any]:
    folder = _folder(slug)
    key = _key(key)
    try:
        spec = ProjectSpec.model_validate(project)
    except ValidationError as e:
        return {"saved": False, "errors": _pydantic_errors(e)}
    (folder / "projects").mkdir(exist_ok=True)
    (folder / "projects" / f"{key}.json").write_text(spec.model_dump_json(indent=2) + "\n")
    rel = f"projects/{key}.json"
    return {"saved": True, **_issues(folder, lambda i: i.path == rel)}


@mcp.tool(description="Check a diagram's source without saving it: kind 'flow' or 'mermaid'.")
def check_diagram(kind: Literal["flow", "mermaid"], source: str) -> dict[str, Any]:
    problem = authoring._diagram_issue(kind, source, True)
    return {"ok": problem is None, "problem": problem}


# ---- check and import ----------------------------------------------------------------------------------


@mcp.tool(description="Check the whole course: every error (blocks import) and warning (teaching rules), each with its file.")
def check_course(slug: str, strict: bool = False) -> dict[str, Any]:
    report = authoring.check_folder(_folder(slug))
    return {"ok": report.ok(strict), **report.as_dict()}


@mcp.tool(description="Check, then import the course so it shows in the Coursewright Library. replace=true updates "
          "a course imported before under the same title and drops the learner's progress on it (ask the user "
          "first). `server` (or CW_SERVER) sends it to a running Coursewright instead of the local database.")
async def import_course(slug: str, replace: bool = False, server: str | None = None) -> dict[str, Any]:
    return await authoring.import_course(_folder(slug), replace=replace, server=server or os.environ.get("CW_SERVER"))


def main() -> None:
    mcp.run("stdio")


if __name__ == "__main__":
    main()
