"""Inkling explainers: the checker (vendored CLI under Node), placing a drawing after its paragraph, the
revision loop, the backfill job and endpoint, the MCP tool, the folder check and the tutor's index."""

from __future__ import annotations

import asyncio
from collections import Counter

import pytest

from app import inkling
from app.db import db, jload, row
from app.jobs import explainers, store
from app.jobs.explainers import ExplainersOut, ExplainerSpec

needs_node = pytest.mark.skipif(not inkling.node_bin(), reason="node is not installed")

GOOD = 'title "The loop"\nlayout cycle\nthink: circle "Think"\nact: circle "Act"\ncycle think, act\nsteps auto'
LESSON = """# Agent loop: think, act, repeat

An agent is a model that keeps going until the job is done.

The loop is simple: the model thinks, asks for a tool, reads what the tool returned, and thinks again.

```python
while True:
    step()
```

> **Key idea:** the loop runs until the model stops asking for tools.

## What you have now

A loop.
"""


@needs_node
def test_check_reports_errors_by_line_and_checks_many_in_one_run():
    good, bad = inkling.check_many([GOOD, 'title "x"\nlayout spiral\na ->'])
    assert good["ok"] and good["errors"] == []
    assert not bad["ok"]
    assert {e["line"] for e in bad["errors"]} == {2, 3}
    assert any(e["code"] == "E-UNKNOWN-LAYOUT" for e in bad["errors"])
    assert "line 2: error" in inkling.format_check(bad)


def test_check_without_node(monkeypatch):
    monkeypatch.setattr(inkling, "node_bin", lambda: None)
    r = inkling.check(GOOD)
    assert not r["ok"] and "node is not installed" in r["errors"][0]["message"]


def test_fences_titles_layouts_and_stripping():
    md = LESSON + "\n" + inkling.fence(GOOD) + "\n"
    (f,) = inkling.fences(md)
    assert (f.title, f.layout) == ("The loop", "cycle")
    assert "(Diagram: The loop)" in inkling.strip_fences(md)
    assert "```inkling" not in inkling.strip_fences(md, keep_title=False)
    assert "```python" in inkling.strip_fences(md)  # other code stays
    assert inkling.source_problems("a -> b") == [
        'give it a title line: title "<the idea in a few words>"',
        'add steps (step 1: names "caption" ...) or "steps auto", so it draws in the reading order',
    ]


def test_insert_goes_after_the_named_paragraph_never_into_code_or_headings():
    spec = ExplainerSpec(after="The loop is simple: the model thinks", idea="loop", source=GOOD)
    new, missing = explainers.insert(LESSON, [spec])
    assert missing == []
    assert new.index("reads what the tool returned") < new.index("```inkling") < new.index("```python")
    assert explainers.find_paragraph(LESSON, "while True: step()") is None  # code is not a paragraph
    assert explainers.find_paragraph(LESSON, "Agent loop: think, act, repeat") is None  # nor a heading
    _, missing = explainers.insert(LESSON, [ExplainerSpec(after="Nothing like this is in the lesson", idea="", source=GOOD)])
    assert "no paragraph opens with" in missing[0]


def test_clean_drops_the_look_and_stray_fences():
    src = "```inkling\npaper napkin\npen marker\n" + GOOD + "\n```"
    assert explainers._clean(src) == GOOD


@needs_node
def test_explain_revises_with_the_problems_then_gives_up_cleanly():
    calls: list[str] = []

    def answer(source: str):
        async def call(system, user):
            calls.append(user)
            ok = len(calls) > 1 and source == "fix"
            return ExplainersOut(explainers=[ExplainerSpec(after="The loop is simple: the model thinks", idea="",
                                                           source=GOOD if ok else 'title "x"\na ->\nsteps auto')])
        return call

    new, used = asyncio.run(explainers.explain(answer("fix"), course="C", title="T", markdown=LESSON, layouts=Counter()))
    assert used == ["cycle"] and "```inkling" in new
    assert "Your previous draft" in calls[1] and "An arrow needs a name on both sides" in calls[1]

    calls.clear()
    new, used = asyncio.run(explainers.explain(answer("never"), course="C", title="T", markdown=LESSON, layouts=Counter()))
    assert new is None and used == [] and len(calls) == 1 + explainers.REVISIONS


def test_prompt_names_the_layouts_used_so_far():
    p = explainers.prompt(course="C", title="T", markdown=LESSON, layouts=Counter({"flow": 3, "cycle": 1}))
    assert "flow 3, cycle 1" in p and "prefer the one the course has used less" in p


@needs_node
def test_backfill_job_adds_explainers_skips_done_chapters_and_reindexes(client, course, monkeypatch):
    from app.agents import llm

    cid = course["id"]
    with db() as conn:
        chs = [dict(r) for r in conn.execute(
            "SELECT ch.id, ch.markdown FROM chapters ch JOIN modules m ON m.id=ch.module_id WHERE ch.course_id=? "
            "ORDER BY m.position, ch.position", (cid,))]
    first, rest = chs[0], chs[1:]
    with db() as conn:  # one chapter already has one, so it is skipped
        conn.execute("UPDATE chapters SET markdown=? WHERE id=?", (first["markdown"] + "\n" + inkling.fence(GOOD) + "\n", first["id"]))

    seen: list[str] = []

    async def fake_parse(*, system, user, schema, **_):
        assert schema is ExplainersOut and "Inkling" in system
        seen.append(user)
        body = user.split("<lesson>\n", 1)[1]
        para = next(b for b in body.split("\n\n") if b.strip() and not b.lstrip().startswith(("#", "`", ">", "-", "|", "1.")))
        return ExplainersOut(explainers=[ExplainerSpec(after=para.strip()[:70], idea="", source=GOOD)]), {"inputTokens": 10, "outputTokens": 5}

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(llm, "parse", fake_parse)

    r = client.post(f"/api/courses/{cid}/explainers", json={})
    assert r.status_code == 202 and r.json()["data"]["started"]
    job_id = r.json()["data"]["jobId"]
    again = client.post(f"/api/courses/{cid}/explainers")
    assert again.json()["data"] == {"jobId": job_id, "started": False}  # one at a time per course

    with db() as conn:
        job = dict(store.get_job(conn, job_id))
    out = asyncio.run(explainers.run(job))
    assert len(seen) == len(rest)
    assert out["added"] + out["skipped"] == len(rest) and out["added"] >= 1
    assert out["layouts"]["cycle"] >= 1 + out["added"]
    with db() as conn:
        md = row(conn, "SELECT markdown FROM chapters WHERE id=?", (rest[0]["id"],))["markdown"]
        assert md.count("```inkling") == 1
        events = [e["message"] for e in conn.execute("SELECT message FROM job_events WHERE job_id=?", (job_id,))]
        texts = [c["text"] for c in conn.execute("SELECT text FROM chunks WHERE chapter_id=?", (rest[0]["id"],))]
    assert any(m.startswith("Drew cycle for") for m in events)
    assert texts and not any("```inkling" in t or "cycle think, act" in t for t in texts)  # the tutor reads words
    assert any("(Diagram: The loop)" in t for t in texts)
    jload(job["input"])  # input round-trips
    assert client.post("/api/courses/nope/explainers").status_code == 404


@needs_node
def test_mcp_check_inkling_and_folder_check(tmp_path):
    from app import authoring, mcp_server

    assert mcp_server.check_inkling(GOOD)["ok"]
    bad = mcp_server.check_inkling("a -> b")
    assert not bad["ok"] and bad["errors"] == [] and len(bad["rules"]) == 2
    assert "Inkling" in mcp_server.get_rules("explainer")

    report = authoring.Report()
    authoring._explainer_issues(report, "chapters/a.md", LESSON + inkling.fence('title "x"\na ->\nsteps auto'), True)
    assert [i.message for i in report.errors] == ['explainer 1 ("x") line 2: An arrow needs a name on both sides, like "a -> b".']


def test_a_step_that_brings_in_nothing_new_is_flagged():
    src = 'title "t"\na -> b\nstep 1: a, b "both"\nstep 2: b "again"\nstep 3: c "new"'
    assert inkling.empty_steps(src) == [2]
    assert any("step 2 only names things" in p for p in inkling.source_problems(src))
    assert inkling.empty_steps(GOOD) == []


def test_clean_drops_steps_that_draw_nothing():
    src = 'title "t"\na -> b\nstep 1: a "first"\nstep 2: a "look at a again"\nstep 3: b "then b"'
    out = explainers._clean(src)
    assert "look at a again" not in out and 'step 3: b "then b"' in out
    assert inkling.empty_steps(out) == []
