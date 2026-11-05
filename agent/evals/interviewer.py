"""Interviewer eval: run the real interviewer prompt for several topics, answering each question with its
recommended option, and check the raw model output (before the API normalises it):
- at most 6 questions before done;
- every question has 2-4 options with distinct labels;
- exactly one option is marked recommended;
- no question is asked twice; it finishes with a summary.
No judge: these are deterministic checks on Claude's structured output."""

from __future__ import annotations

from evals.common import Estimate, actual_cost

TOPICS = [
    "Raft consensus",
    "Rust ownership and borrowing",
    "Linear algebra for machine learning",
    "Postgres query planning",
    "Writing a compiler in OCaml",
    "Watercolour painting",
]
MAX_QUESTIONS = 6


def estimate(limit: int | None = None) -> list[Estimate]:
    n = len(TOPICS[:limit] if limit else TOPICS)
    calls = n * (MAX_QUESTIONS + 1)
    return [Estimate("interviewer steps (effort low)", calls, calls * 2_500, calls * 1_500)]


async def interview(topic: str) -> dict:
    from app import config
    from app.agents.llm import parse
    from app.api.interview import ClaudeStep

    answers: list[dict] = []
    questions, problems, usages = [], [], []
    summary = None
    for step_no in range(MAX_QUESTIONS + 2):
        lines = [f"Topic: {topic}", f"Questions answered so far: {len(answers)} (max {MAX_QUESTIONS})"]
        for i, a in enumerate(answers, 1):
            lines.append(f"{i}. Q: {a['question']}\n   A: {', '.join(a['answer'])}")
        if len(answers) >= MAX_QUESTIONS:
            lines.append("You have asked the maximum number of questions: set done = true now.")
        step, usage = await parse(system=config.prompt("interviewer"), user="\n".join(lines), schema=ClaudeStep,
                                  effort="low", max_tokens=4000)
        usages.append(usage)
        if step.done or step.question is None:
            summary = step.summary
            break
        q = step.question
        labels = [o.label.strip().lower() for o in q.options]
        recs = sum(1 for o in q.options if o.recommended)
        if not 2 <= len(q.options) <= 4:
            problems.append(f"q{step_no + 1}: {len(q.options)} options")
        if len(set(labels)) != len(labels):
            problems.append(f"q{step_no + 1}: duplicate option labels {labels}")
        if recs != 1:
            problems.append(f"q{step_no + 1}: {recs} recommended options")
        if q.question in [x["question"] for x in questions]:
            problems.append(f"q{step_no + 1}: repeated question")
        questions.append(q.model_dump())
        pick = next((o for o in q.options if o.recommended), q.options[0])
        answers.append({"question": q.question, "answer": [pick.label]})
    if len(questions) > MAX_QUESTIONS:
        problems.append(f"asked {len(questions)} questions (max {MAX_QUESTIONS})")
    if summary is None:
        problems.append("never finished")
    return {"topic": topic, "questions": questions, "summary": summary, "problems": problems, "usage": usages}


async def run(limit: int | None = None) -> dict:
    results = []
    for topic in TOPICS[:limit] if limit else TOPICS:
        print(f"[interviewer] {topic}")
        r = await interview(topic)
        print(f"   -> {len(r['questions'])} questions, " + ("ok" if not r["problems"] else "; ".join(r["problems"])))
        results.append(r)
    usages = [u for r in results for u in r.pop("usage")]
    return {
        "summary": {
            "n": len(results),
            "passRate": sum(not r["problems"] for r in results) / max(len(results), 1),
            "meanQuestions": sum(len(r["questions"]) for r in results) / max(len(results), 1),
            "costUsd": round(actual_cost(usages), 2),
        },
        "results": results,
    }
