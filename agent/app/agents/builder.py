"""Course builder: a deepagents orchestrator with six subagents, writing files to disk.

Storage: CompositeBackend with the default StateBackend for scratch files and FilesystemBackends rooted at
agent/data/jobs/<job_id>/course and /research, so `/course/...` and `/research/...` land on disk.

Resume: pass the AsyncSqliteSaver as `checkpointer` and use thread_id = job id. A re-claimed job streams
with input None, which continues the same thread from its last checkpoint; the files on disk persist.
"""

from __future__ import annotations

from pathlib import Path

from app import config
from app.agents.diagrammer import subagent_spec as diagrammer_spec
from app.agents.llm import chat_model

WEB_SEARCH_TOOL = {"type": "web_search_20260209", "name": "web_search", "max_uses": 5}


def build_agent(job_dir: Path, *, web_search: bool = True, checkpointer=None):
    from deepagents import create_deep_agent
    from deepagents.backends import CompositeBackend, FilesystemBackend, StateBackend

    (job_dir / "course" / "chapters").mkdir(parents=True, exist_ok=True)
    (job_dir / "course" / "projects").mkdir(parents=True, exist_ok=True)
    (job_dir / "course" / "diagrams").mkdir(parents=True, exist_ok=True)
    (job_dir / "research").mkdir(parents=True, exist_ok=True)

    backend = CompositeBackend(
        default=StateBackend(),
        routes={
            "/course/": FilesystemBackend(root_dir=job_dir / "course", virtual_mode=True),
            "/research/": FilesystemBackend(root_dir=job_dir / "research", virtual_mode=True),
        },
    )
    fmt = config.prompt("course_format")
    worker = chat_model("medium", max_tokens=32000)
    subagents = [
        {
            "name": "researcher",
            "description": "Researches the topic for the learner's level: core ideas, common mistakes, references. "
            "Writes /research/notes.md and /research/refs.json.",
            "system_prompt": config.prompt("researcher"),
            "model": worker,
            "tools": [WEB_SEARCH_TOOL] if web_search else [],
        },
        {
            "name": "curriculum",
            "description": "Designs the concept graph and the module/chapter outline. Writes /course/graph.json and "
            "/course/outline.json.",
            "system_prompt": config.prompt("curriculum") + "\n\n" + fmt,
            "model": worker,
            "tools": [],
        },
        {
            "name": "writer",
            "description": "Writes the chapters of ONE module (markdown + questions + a diagramRequest). Give it the "
            "module key, chapter keys/titles and concepts.",
            "system_prompt": config.prompt("writer") + "\n\n" + fmt,
            "model": worker,
            "tools": [],
        },
        diagrammer_spec(job_dir / "course", worker),
        {
            "name": "project_designer",
            "description": "Designs the end-of-module projects with milestones, hints, rubric and starter files. "
            "Writes /course/projects/<key>.json.",
            "system_prompt": config.prompt("project_designer") + "\n\n" + fmt,
            "model": worker,
            "tools": [],
        },
        {
            "name": "reviewer",
            "description": "Reviews coverage, prerequisite order, question quality, accuracy and file validity. "
            "Writes /course/review.md.",
            "system_prompt": config.prompt("reviewer") + "\n\n" + fmt,
            "model": chat_model("high", max_tokens=16000),
            "tools": [],
        },
    ]
    return create_deep_agent(
        model=chat_model("high", max_tokens=16000),
        tools=[],
        system_prompt=config.prompt("builder") + "\n\n" + fmt,
        subagents=subagents,
        backend=backend,
        checkpointer=checkpointer,
        name="course_builder",
    )
