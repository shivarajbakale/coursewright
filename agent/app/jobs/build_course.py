"""build_course job: run the builder deep agent, map its progress to job_events, materialise, ingest."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path

from app import config
from app.agents import checkpoint
from app.agents.diagrammer import validate_course_diagrams
from app.db import db, jload, row
from app.jobs import store
from app.materialise import MaterialiseError, parse_course_folder, write_course
from app.rag import ingest

log = logging.getLogger(__name__)

SUBAGENT_STAGE = {
    "researcher": ("research", "Researching the topic"),
    "curriculum": ("concepts", "Mapping the concepts"),
    "writer": ("chapters", "Writing chapters"),
    "diagrammer": ("chapters", "Drawing diagrams"),
    "project_designer": ("projects", "Designing projects"),
    "reviewer": ("projects", "Reviewing the course"),
}


def last_stage(job_id: str) -> str:
    with db() as conn:
        r = row(conn, "SELECT stage FROM job_events WHERE job_id=? ORDER BY seq DESC LIMIT 1", (job_id,))
    return r["stage"] if r and r["stage"] != "done" else "research"


def mark_failed(job: dict, msg: str) -> None:
    if job.get("course_id"):
        with db() as conn:
            conn.execute("UPDATE courses SET status='failed' WHERE id=? AND status!='ready'", (job["course_id"],))


def _brief_text(brief: dict) -> str:
    lines = [f"Build a course on: {brief.get('topic')}"]
    for k in ("level", "goal", "pace"):
        if brief.get(k):
            lines.append(f"{k.capitalize()}: {brief[k]}")
    if brief.get("answers"):
        lines.append("\nInterview answers:")
        for a in brief["answers"]:
            lines.append(f"- {a.get('question')}: {', '.join(a.get('answer') or []) or '(skipped)'}")
    return "\n".join(lines)


class Progress:
    """Turns stream updates and files appearing on disk into job_events."""

    def __init__(self, job_id: str, job_dir: Path) -> None:
        self.job_id = job_id
        self.job_dir = job_dir
        self.seen_files: set[str] = set()
        self.seen_msgs: set[str] = set()
        self.input_tokens = 0
        self.output_tokens = 0
        self.total_chapters = 0

    def emit(self, stage: str, message: str, payload: dict | None = None) -> None:
        store.emit(self.job_id, stage, message, payload or {})

    # -- stream updates -----------------------------------------------------------------------
    def on_update(self, chunk) -> None:
        _ns, update = chunk if isinstance(chunk, tuple) and len(chunk) == 2 else ((), chunk)
        if not isinstance(update, dict):
            return
        for node_update in update.values():
            if not isinstance(node_update, dict):
                continue
            msgs = node_update.get("messages")
            msgs = getattr(msgs, "value", msgs)  # Overwrite wrapper
            if not isinstance(msgs, list):
                continue
            for m in msgs:
                mid = getattr(m, "id", None)
                if getattr(m, "type", None) != "ai" or (mid and mid in self.seen_msgs):
                    continue
                if mid:
                    self.seen_msgs.add(mid)
                usage = getattr(m, "usage_metadata", None) or {}
                self.input_tokens += int(usage.get("input_tokens") or 0)
                self.output_tokens += int(usage.get("output_tokens") or 0)
                for tc in getattr(m, "tool_calls", None) or []:
                    if tc.get("name") == "task":
                        sub = (tc.get("args") or {}).get("subagent_type", "")
                        stage, msg = SUBAGENT_STAGE.get(sub, ("research", f"Working: {sub}"))
                        desc = re.sub(r"\s+", " ", str((tc.get("args") or {}).get("description", "")))[:120]
                        self.emit(stage, f"{msg}: {desc}" if desc else msg, {"subagent": sub})

    # -- files on disk ------------------------------------------------------------------------
    def prime(self) -> None:
        """Resuming: files already on disk were reported before the restart, so mark them seen silently."""
        real_emit = self.emit
        self.emit = lambda *a, **k: None  # type: ignore[method-assign]
        try:
            self.scan()
        finally:
            self.emit = real_emit  # type: ignore[method-assign]

    def _read_json(self, p: Path) -> dict:
        """The file as an object; a list (some models write refs as a bare list) becomes {"items": [...]}."""
        try:
            data = json.loads(p.read_text())
        except Exception:  # noqa: BLE001 - partially written file
            return {}
        if isinstance(data, list):
            return {"items": data}
        return data if isinstance(data, dict) else {}

    def scan(self) -> None:
        """Progress events from files on disk. Display only: a surprise in a file never stops the build."""
        try:
            self._scan()
        except Exception:  # noqa: BLE001
            log.warning("progress scan failed for job %s", self.job_id, exc_info=True)

    def _scan(self) -> None:
        course = self.job_dir / "course"
        research = self.job_dir / "research"
        refs = research / "refs.json"
        if refs.exists() and "refs" not in self.seen_files:
            data = self._read_json(refs)
            if data:
                self.seen_files.add("refs")
                terms = data.get("terms") or [
                    (i.get("title") or i.get("name") or "") if isinstance(i, dict) else str(i) for i in data.get("items", [])
                ]
                self.emit("research", "Research notes ready", {"terms": [str(t)[:40] for t in terms if t][:10]})
        graph = course / "graph.json"
        if graph.exists() and "graph" not in self.seen_files:
            data = self._read_json(graph)
            if data.get("concepts"):
                self.seen_files.add("graph")
                names = [c.get("name", "") for c in data["concepts"]]
                self.emit("concepts", f"Mapped {len(names)} concepts", {"concepts": names})
        outline = course / "outline.json"
        if outline.exists() and "outline" not in self.seen_files:
            data = self._read_json(outline)
            if data.get("modules"):
                self.seen_files.add("outline")
                self.total_chapters = sum(len(m.get("chapters", [])) for m in data["modules"])
                if "graph" not in self.seen_files and data.get("concepts"):
                    self.seen_files.add("graph")
                    self.emit("concepts", "Mapped concepts", {"concepts": [c.get("name", "") for c in data["concepts"]]})
                self.emit(
                    "outline",
                    f"Outlined {len(data['modules'])} modules, {self.total_chapters} chapters",
                    {"modules": [m.get("title", "") for m in data["modules"]]},
                )
                self.titles = {ch["key"]: ch.get("title", ch["key"]) for m in data["modules"] for ch in m.get("chapters", [])}
        for md in sorted((course / "chapters").glob("*.md")):
            key = f"ch:{md.stem}"
            if key not in self.seen_files:
                self.seen_files.add(key)
                done = len([k for k in self.seen_files if k.startswith("ch:")])
                title = getattr(self, "titles", {}).get(md.stem, md.stem)
                self.emit(
                    "chapters",
                    f"Wrote {title}",
                    {"chapter": title, "done": done, "total": max(self.total_chapters, done)},
                )
        diagrams = course / "diagrams"
        for f in sorted(list(diagrams.glob("*.flow")) + list(diagrams.glob("*.mmd"))) if diagrams.exists() else []:
            key = f"dg:{f.name}"
            if key not in self.seen_files:
                self.seen_files.add(key)
                title = getattr(self, "titles", {}).get(f.stem, f.stem)
                what = "a movie" if f.suffix == ".flow" else "a diagram"
                self.emit("chapters", f"Drew {what} for {title}", {"diagram": title, "kind": f.suffix[1:]})
        projects = []
        for pj in sorted((course / "projects").glob("*.json")):
            key = f"pj:{pj.stem}"
            if key not in self.seen_files:
                data = self._read_json(pj)
                if data.get("title"):
                    self.seen_files.add(key)
                    projects.append(data["title"])
        if projects:
            self.emit("projects", f"Designed {', '.join(projects)}", {"projects": projects})


async def run(job: dict) -> dict:
    job_id = job["id"]
    course_id = job["course_id"]
    brief = jload(job["input"], {}).get("brief") or {}
    with db() as conn:
        conn.execute("UPDATE courses SET status='building' WHERE id=?", (course_id,))

    if not config.anthropic_key():
        msg = "ANTHROPIC_API_KEY is not set"
        store.emit(job_id, "research", f"Can't build the course: {msg}", {"error": msg})
        raise RuntimeError(msg)

    job_dir = config.jobs_dir() / job_id
    job_dir.mkdir(parents=True, exist_ok=True)
    if not (job_dir / "brief.json").exists():
        (job_dir / "brief.json").write_text(json.dumps(brief, indent=2))  # for evals and debugging
    progress = Progress(job_id, job_dir)
    budget = config.build_token_budget()

    # Resume shortcut: when every file the outline asks for is already on disk and parses, the agents
    # have nothing left to write, so go straight to saving and indexing. A reviewer pass over a big
    # course costs millions of input tokens for little gain, and a restarted build shouldn't redo it.
    try:
        await asyncio.to_thread(parse_course_folder, job_dir / "course")
        files_complete = True
    except Exception:  # noqa: BLE001 - missing or partial files: the agents still have work
        files_complete = False
    if files_complete:
        await asyncio.to_thread(progress.prime)
        progress.emit("projects", "All course files are written; saving the course", {})
    else:
        await _run_agents(job, job_dir, brief, progress, budget)
    await _finish(job_id, course_id, job_dir, progress)
    return {"courseId": course_id, "usage": {"inputTokens": progress.input_tokens, "outputTokens": progress.output_tokens}}


def _course_complete(job_dir) -> bool:
    """Every file the outline asks for is on disk and parses: the course can be saved as it stands."""
    try:
        parse_course_folder(job_dir / "course")
        return True
    except Exception:  # noqa: BLE001 - missing or partial files
        return False


# The budget is when polishing stops, not when a build fails. Past it, a complete course is saved as it
# stands; an incomplete one keeps going, and only a build still unfinished at RUNAWAY x the budget (an
# agent loop that is not converging) is stopped.
RUNAWAY = 3


async def _run_agents(job: dict, job_dir, brief: dict, progress: "Progress", budget: int) -> None:
    from langchain_core.messages import HumanMessage

    from app.agents.builder import build_agent

    job_id = job["id"]
    checked_at = 0  # tokens spent when completeness was last checked; parsing every chunk is wasteful

    async with checkpoint.saver() as cp:
        resuming = await checkpoint.has_checkpoint(cp, job_id)
        if resuming:
            usage = jload(job.get("usage"), None) or {}
            progress.input_tokens = int(usage.get("inputTokens") or 0)
            progress.output_tokens = int(usage.get("outputTokens") or 0)
            await asyncio.to_thread(progress.prime)
            progress.emit(last_stage(job_id), "Resuming the build where it stopped", {"resumed": True})
            stream_input = None  # continue the same thread from its last checkpoint
        else:
            topic_terms = [w for w in re.findall(r"[A-Za-z][\w-]+", brief.get("topic", "")) if len(w) > 2][:6]
            progress.emit("research", "Planning the course", {"terms": topic_terms})
            stream_input = {"messages": [HumanMessage(content=_brief_text(brief))]}

        agent = build_agent(job_dir, checkpointer=cp)
        stream = agent.astream(
            stream_input,
            config={"recursion_limit": 1000, "configurable": {"thread_id": job_id}},
            stream_mode="updates",
            subgraphs=True,
        )
        try:
            async for chunk in stream:
                # Every DB write goes through a thread: a blocking write on the event loop can't finish while
                # the async checkpointer (same file, same loop) holds the write lock, and times out.
                await asyncio.to_thread(store.check_cancel, job_id)
                await asyncio.to_thread(progress.on_update, chunk)
                await asyncio.to_thread(progress.scan)
                await asyncio.to_thread(store.set_usage, job_id, progress.input_tokens, progress.output_tokens)
                spent = progress.input_tokens + progress.output_tokens
                if spent > budget and spent - checked_at > 50_000:
                    checked_at = spent
                    if await asyncio.to_thread(_course_complete, job_dir):
                        log.info("build %s: %d tokens, course complete; saving it as written", job_id, spent)
                        progress.emit("projects", "The course is complete; saving it", {})
                        break
                    if spent > budget * RUNAWAY:
                        raise RuntimeError(
                            "The agents kept working without finishing the course. Start the build again; "
                            "if it stops here twice, try a narrower topic."
                        )
        finally:
            await stream.aclose()  # leaving early must still close the agent's stream and its subgraphs
    await asyncio.to_thread(progress.scan)


async def _finish(job_id: str, course_id: str, job_dir, progress: "Progress") -> None:
    await asyncio.to_thread(store.check_cancel, job_id)

    rejected = await asyncio.to_thread(validate_course_diagrams, job_dir / "course")
    if rejected:
        progress.emit("chapters", f"Dropped {len(rejected)} movie(s) that don't compile", {"rejected": rejected})

    try:
        parsed = await asyncio.to_thread(parse_course_folder, job_dir / "course")
    except MaterialiseError as e:
        raise RuntimeError(f"The generated course files are invalid: {e}") from e

    def save() -> None:
        with db() as conn:
            c = row(conn, "SELECT brief FROM courses WHERE id=?", (course_id,))
            if not c:
                raise store.Cancelled()  # course deleted mid-build
            write_course(conn, parsed, course_id=course_id)

    await asyncio.to_thread(save)
    progress.emit("index", "Indexing the course for the tutor", {"chunks": 0})
    chunks = await ingest.ingest_course(course_id)
    progress.emit("index", f"Indexed {chunks} passages", {"chunks": chunks})
    progress.emit("done", "Your course is ready", {"courseId": course_id})
