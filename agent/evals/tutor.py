"""Tutor eval: 30 questions on the seeded Raft course (25 in scope, 5 out of scope).

For each question the real tutor graph runs (same tools, prompt and model as /agents/tutor, an in-memory
checkpointer, App Context = the Raft course). We record its search_course hits and answer, then grade:
- automatic: cited [n] numbers exist in the hits; the expected chapter was retrieved / cited;
- LLM judge (claude-opus-5-5): groundedness (1-5), citation accuracy, key facts covered, and whether it says
  plainly when the course doesn't cover something (the out-of-scope questions).
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from evals.common import Estimate, actual_cost, judge

DATASET = Path(__file__).parent / "datasets" / "tutor_raft.json"
CITE = re.compile(r"\[(\d+)\]")


def load() -> list[dict]:
    return json.loads(DATASET.read_text())["questions"]


def estimate(limit: int | None = None) -> list[Estimate]:
    n = len(load()[:limit] if limit else load())
    # The tutor: ~3 model calls per question (search, maybe read_chapter, answer) at ~12k input tokens each.
    return [
        Estimate("tutor answers (agent under test)", n * 3, n * 36_000, n * 4_500),
        Estimate("judge (claude-opus-5-5, effort high)", n, n * 7_000, n * 1_500),
    ]


class Judgement(BaseModel):
    groundedness: int  # 1-5: every claim is supported by the retrieved passages (or flagged as not from the course)
    citations_accurate: bool  # each [n] points at a passage that supports the sentence it is attached to
    key_facts_covered: list[bool]  # one per expected fact, in order
    says_when_not_covered: Literal["yes", "no", "not_applicable"]
    verdict: Literal["pass", "fail"]
    notes: str


JUDGE_SYSTEM = """You grade answers from a course tutor. The tutor must answer from the learner's course
material, cite the passages it used as [n] (n = the hit number in its search results), and say plainly when
the course doesn't cover something before answering from general knowledge.

Grade strictly from the evidence given:
- groundedness 1-5: 5 = every factual claim is supported by a retrieved passage or explicitly marked as not
  from the course; 1 = mostly unsupported or contradicted.
- citations_accurate: true only if every [n] exists in the hits and supports the sentence it is on. An
  answer with no citations to in-scope content is false.
- key_facts_covered: one boolean per expected fact, in the order given.
- says_when_not_covered: for questions marked out of scope, "yes" if the answer clearly says the course does
  not cover it (or only partly covers it) before or instead of answering from general knowledge, "no"
  otherwise; for in-scope questions, "not_applicable".
- verdict: pass if groundedness >= 4, citations are accurate (or, out of scope, it says so), and most key
  facts are covered."""


async def ask_tutor(graph, course_id: str, question: str) -> dict:
    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    from app.db import new_id

    state = {
        "messages": [HumanMessage(content=question)],
        "copilotkit": {"actions": [], "context": [{"description": "courseId", "value": course_id}]},
    }
    out = await graph.ainvoke(state, {"configurable": {"thread_id": new_id()}, "recursion_limit": 60})
    searches, tools_used, usage = [], [], {"inputTokens": 0, "outputTokens": 0}
    for m in out["messages"]:
        if isinstance(m, AIMessage):
            u = m.usage_metadata or {}
            usage["inputTokens"] += int(u.get("input_tokens") or 0)
            usage["outputTokens"] += int(u.get("output_tokens") or 0)
            tools_used += [tc["name"] for tc in m.tool_calls or []]
        if isinstance(m, ToolMessage) and m.name == "search_course":
            try:
                searches.append(json.loads(m.content if isinstance(m.content, str) else m.text)["hits"])
            except (ValueError, KeyError, TypeError):
                searches.append([])
    final = next((m for m in reversed(out["messages"]) if isinstance(m, AIMessage)), None)
    return {"answer": final.text if final else "", "searches": searches, "tools": tools_used, "usage": usage}


def auto_checks(item: dict, run: dict, key_by_chapter_id: dict[str, str]) -> dict:
    cited = [int(n) for n in CITE.findall(run["answer"])]
    last = run["searches"][-1] if run["searches"] else []
    all_hits = [h for s in run["searches"] for h in s]
    valid = all(1 <= n <= max((len(s) for s in run["searches"]), default=0) for n in cited)
    cited_keys = {key_by_chapter_id.get(h["chapterId"]) for h in last if h["n"] in cited}
    retrieved_keys = {key_by_chapter_id.get(h["chapterId"]) for h in all_hits}
    expected = set(item["chapters"])
    return {
        "cited": cited,
        "citationsInRange": valid,
        "expectedChapterRetrieved": bool(expected & retrieved_keys) if expected else None,
        "expectedChapterCited": bool(expected & cited_keys) if expected else None,
    }


async def run(limit: int | None = None) -> dict:
    from langgraph.checkpoint.memory import InMemorySaver

    from app.agents.tutor import build_tutor_graph
    from app.db import db, init_db, rows
    from app.seed import seed_and_index
    from app.seed import SEED_DIR

    init_db()
    await seed_and_index()
    outline = json.loads((SEED_DIR / "outline.json").read_text())
    key_by_title = {ch["title"]: ch["key"] for m in outline["modules"] for ch in m["chapters"]}
    with db() as conn:
        course = rows(conn, "SELECT id FROM courses WHERE seed_key='raft'")
        if not course:
            raise SystemExit("The seeded Raft course is missing (was it deleted?). Delete agent/data/ to reseed.")
        course_id = course[0]["id"]
        key_by_chapter_id = {
            r["id"]: key_by_title.get(r["title"], r["title"])
            for r in rows(conn, "SELECT id, title FROM chapters WHERE course_id=?", (course_id,))
        }

    graph = build_tutor_graph(InMemorySaver())
    items = load()[:limit] if limit else load()
    results, usages = [], []
    for item in items:
        print(f"[{item['id']}] {item['question']}")
        r = await ask_tutor(graph, course_id, item["question"])
        usages.append(r["usage"])
        auto = auto_checks(item, r, key_by_chapter_id)
        hits_text = "\n\n".join(
            f"Search {si}:\n" + "\n".join(f"[{h['n']}] ({key_by_chapter_id.get(h['chapterId'], '?')}) {h['title']}: {h['text'][:1500]}" for h in s)
            for si, s in enumerate(r["searches"], 1)
        ) or "(the tutor did not search)"
        verdict, ju = await judge(
            system=JUDGE_SYSTEM,
            user=(
                f"Question: {item['question']}\n"
                f"In scope: {'no' if item.get('outOfScope') else 'yes'}\n"
                f"Expected chapters: {', '.join(item['chapters']) or '(none)'}\n"
                "Expected facts:\n" + "\n".join(f"{i}. {f}" for i, f in enumerate(item["facts"], 1))
                + f"\n\nRetrieved passages:\n{hits_text}\n\nTutor's answer:\n{r['answer']}"
            ),
            schema=Judgement,
        )
        usages.append(ju)
        print(f"   -> {verdict.verdict} (grounded {verdict.groundedness}/5, citations {'ok' if verdict.citations_accurate else 'bad'})")
        results.append({**item, "answer": r["answer"], "tools": r["tools"], "auto": auto, "judge": verdict.model_dump()})

    in_scope = [x for x in results if not x.get("outOfScope")]
    oos = [x for x in results if x.get("outOfScope")]
    summary = {
        "n": len(results),
        "passRate": sum(x["judge"]["verdict"] == "pass" for x in results) / max(len(results), 1),
        "meanGroundedness": sum(x["judge"]["groundedness"] for x in results) / max(len(results), 1),
        "citationAccuracy": sum(x["judge"]["citations_accurate"] for x in in_scope) / max(len(in_scope), 1),
        "citationsInRange": sum(x["auto"]["citationsInRange"] for x in results) / max(len(results), 1),
        "expectedChapterRetrieved": sum(bool(x["auto"]["expectedChapterRetrieved"]) for x in in_scope) / max(len(in_scope), 1),
        "keyFactRecall": sum(sum(x["judge"]["key_facts_covered"]) / max(len(x["facts"]), 1) for x in in_scope)
        / max(len(in_scope), 1),
        "saysWhenNotCovered": sum(x["judge"]["says_when_not_covered"] == "yes" for x in oos) / max(len(oos), 1),
        "costUsd": round(actual_cost(usages), 2),
    }
    return {"summary": summary, "results": results}
