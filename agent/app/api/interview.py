"""POST /interview/next: the next AskUserQuestion-shaped question, or done + a short summary.

With ANTHROPIC_API_KEY: Claude (effort low, structured output). Without: a deterministic set of four
generic questions so the UI flow still works.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app import config
from app.api.common import ok

log = logging.getLogger(__name__)
router = APIRouter()

MAX_QUESTIONS = 6


class Answer(BaseModel):
    question: str
    answer: list[str] = []


class InterviewIn(BaseModel):
    topic: str = Field(min_length=1)
    answers: list[Answer] = []


class Option(BaseModel):
    label: str
    description: str
    recommended: bool = False


class InterviewQuestion(BaseModel):
    id: str
    header: str
    question: str
    multiSelect: bool
    options: list[Option]


class ClaudeStep(BaseModel):
    done: bool
    question: InterviewQuestion | None
    summary: str | None
    level: str | None
    goal: str | None
    pace: str | None


def _fallback_questions(topic: str) -> list[dict]:
    return [
        {
            "id": "level",
            "header": "Level",
            "question": f"How much do you already know about {topic}?",
            "multiSelect": False,
            "options": [
                {"label": "New to it", "description": "Start from first principles and define every term."},
                {"label": "Some basics", "description": "Skim the fundamentals and spend time on the core ideas.", "recommended": True},
                {"label": "Used it before", "description": "Skip the basics and go deep on edge cases and trade-offs."},
            ],
        },
        {
            "id": "goal",
            "header": "Goal",
            "question": f"What do you want to be able to do with {topic} at the end?",
            "multiSelect": False,
            "options": [
                {"label": "Understand it", "description": "Explain how it works and why, with clear mental models."},
                {"label": "Build with it", "description": "Implement it or use it in a real project.", "recommended": True},
                {"label": "Pass an interview", "description": "Focus on the questions and trade-offs interviewers ask about."},
            ],
        },
        {
            "id": "pace",
            "header": "Pace",
            "question": "How much time can you give it each week?",
            "multiSelect": False,
            "options": [
                {"label": "1-2 hours", "description": "A short course: about 6 chapters and one small project."},
                {"label": "3-5 hours", "description": "A full course: about 10 chapters and a project per module.", "recommended": True},
                {"label": "6+ hours", "description": "A deep course with longer chapters and bigger projects."},
            ],
        },
        {
            "id": "projects",
            "header": "Projects",
            "question": "What kind of hands-on work do you want?",
            "multiSelect": True,
            "options": [
                {"label": "Build from scratch", "description": "Implement the core ideas yourself, step by step.", "recommended": True},
                {"label": "Read real code", "description": "Study how an existing open-source project does it."},
                {"label": "Small exercises", "description": "Short drills after each chapter instead of big projects."},
                {"label": "No projects", "description": "Reading and quizzes only."},
            ],
        },
    ]


def _fill(q: dict) -> dict:
    q = dict(q)
    q["options"] = [{"label": o["label"], "description": o["description"], "recommended": bool(o.get("recommended"))} for o in q["options"]]
    return q


def _fallback(body: InterviewIn) -> dict:
    qs = _fallback_questions(body.topic.strip())
    n = len(body.answers)
    if n < len(qs):
        return {"question": _fill(qs[n]), "done": False, "summary": None}
    by_q = {a.question: ", ".join(a.answer) or "no preference" for a in body.answers}
    level = by_q.get(qs[0]["question"], "your current level")
    goal = by_q.get(qs[1]["question"], "understand it well")
    pace = by_q.get(qs[2]["question"], "a steady pace")
    projects = by_q.get(qs[3]["question"], "hands-on projects")
    summary = (
        f"You'll get a course on {body.topic.strip()} pitched at \"{level.lower()}\", aimed at \"{goal.lower()}\". "
        f"It's sized for {pace} a week, with project work shaped as: {projects.lower()}."
    )
    return {"question": None, "done": True, "summary": summary, "level": level, "goal": goal, "pace": pace}


async def _claude(body: InterviewIn) -> dict:
    from app.agents.llm import parse

    lines = [f"Topic: {body.topic.strip()}", f"Questions answered so far: {len(body.answers)} (max {MAX_QUESTIONS})"]
    for i, a in enumerate(body.answers, 1):
        lines.append(f"{i}. Q: {a.question}\n   A: {', '.join(a.answer) or '(skipped)'}")
    if len(body.answers) >= MAX_QUESTIONS:
        lines.append("You have asked the maximum number of questions: set done = true now.")
    step, _usage = await parse(
        system=config.prompt("interviewer"),
        user="\n".join(lines),
        schema=ClaudeStep,
        effort="low",
        max_tokens=4000,
    )
    if len(body.answers) >= MAX_QUESTIONS:
        step.done = True
    if step.done or step.question is None:
        out = {"question": None, "done": True, "summary": step.summary or "Your course is ready to build."}
        for k in ("level", "goal", "pace"):
            if getattr(step, k):
                out[k] = getattr(step, k)
        return out
    q = step.question.model_dump()
    # Guarantee exactly one recommended option.
    recs = [i for i, o in enumerate(q["options"]) if o.get("recommended")]
    for i, o in enumerate(q["options"]):
        o["recommended"] = i == (recs[0] if recs else 0)
    return {"question": q, "done": False, "summary": None}


@router.post("/interview/next")
async def interview_next(body: InterviewIn):
    if not config.anthropic_key():
        return ok(_fallback(body))
    try:
        return ok(await _claude(body))
    except Exception as e:  # noqa: BLE001
        log.exception("interviewer failed")
        raise HTTPException(status_code=502, detail=f"Interviewer failed: {e}") from e
