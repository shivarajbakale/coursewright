"""The accuracy pass: a built course's lessons are checked again and only what is wrong is corrected."""

from __future__ import annotations

import asyncio

from app.db import db, row
from app.jobs import accuracy, store
from app.jobs.accuracy import Correction, QuestionFix
from app.jobs.pipeline import VerifyOut


def _two(course):
    chs = [c for m in course["modules"] for c in m["chapters"]][:2]
    with db() as conn:
        saved = {c["id"]: row(conn, "SELECT markdown FROM chapters WHERE id=?", (c["id"],))["markdown"] for c in chs}
    return chs, saved


def _restore(saved):
    with db() as conn:
        for cid, md in saved.items():
            conn.execute("UPDATE chapters SET markdown=? WHERE id=?", (md, cid))


def test_a_wrong_lesson_is_corrected_and_a_right_one_left_alone(client, course, monkeypatch):
    from app.agents import llm

    (wrong, right), saved = _two(course)
    with db() as conn:
        md = saved[wrong["id"]] + "\n\nSo 3 × 4 = 13, a gain.\n"
        conn.execute("UPDATE chapters SET markdown=? WHERE id=?", (md, wrong["id"]))
        q = row(conn, "SELECT id, options FROM questions WHERE chapter_id=? ORDER BY position", (wrong["id"],))
    calls = {"verify": 0, "fix": 0}

    async def fake_parse(*, system, user, schema, **_):
        if schema is VerifyOut:
            calls["verify"] += 1
            return VerifyOut(issues=["'3 × 4 = 13' should be 12"] if "3 × 4 = 13" in user else []), {}
        assert schema is Correction and "3 × 4 = 13" in user and "should be 12" in user
        calls["fix"] += 1
        return Correction(markdown=user.split("The lesson:\n\n", 1)[1].split("\n\nIts questions:")[0]
                          .replace("3 × 4 = 13", "3 × 4 = 12"),
                          questions=[QuestionFix(number=1, prompt="Fixed?", options=["a", "b", "c"], answer=2,
                                                 explanation="Because c.")]), {}

    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(llm, "parse", fake_parse)
    try:
        r = client.post(f"/api/courses/{course['id']}/accuracy", json={"chapterIds": [wrong["id"], right["id"]], "apply": True})
        assert r.status_code == 202 and r.json()["data"]["started"]
        job_id = r.json()["data"]["jobId"]
        assert client.post(f"/api/courses/{course['id']}/accuracy").json()["data"] == {"jobId": job_id, "started": False}
        with db() as conn:
            job = dict(store.get_job(conn, job_id))
        out = asyncio.run(accuracy.run(job))
        assert out["total"] == 2 and out["withMistakes"] == 1 and out["corrected"] == 1
        rec = next(x for x in out["lessons"] if x["id"] == wrong["id"])
        assert rec["kept"] and "3 × 4 = 13" in rec["before"]["markdown"] and "3 × 4 = 12" in rec["after"]["markdown"]
        assert calls["fix"] == 1  # the right lesson is never sent for correction
        with db() as conn:
            assert "3 × 4 = 12" in row(conn, "SELECT markdown FROM chapters WHERE id=?", (wrong["id"],))["markdown"]
            fixed = row(conn, "SELECT prompt, answer FROM questions WHERE id=?", (q["id"],))
        assert fixed["prompt"] == "Fixed?" and fixed["answer"] == 2
        assert client.post("/api/courses/nope/accuracy").status_code == 404
    finally:
        _restore(saved)


def test_a_correction_that_drops_a_drawing_or_is_no_better_is_not_kept(client, course, monkeypatch):
    from app.agents import llm

    (lesson, _), saved = _two(course)
    data = {"id": lesson["id"], "title": lesson["title"], "markdown": saved[lesson["id"]] + "\n\n```inkling\ntitle \"x\"\na -> b\nsteps auto\n```\n",
            "questions": []}
    drop = Correction(markdown=saved[lesson["id"]])
    assert "dropped or added a drawing" in " ".join(accuracy.correction_problems(data, drop))

    async def stubborn(*, system, user, schema, **_):  # every check finds the same mistake
        if schema is VerifyOut:
            return VerifyOut(issues=["this number is wrong"]), {}
        return Correction(markdown=saved[lesson["id"]]), {}

    monkeypatch.setattr(llm, "parse", stubborn)

    async def call(system, user, schema, max_tokens):
        return (await llm.parse(system=system, user=user, schema=schema))[0]

    plain = {**data, "markdown": saved[lesson["id"]]}
    rec = asyncio.run(accuracy.correct(call, plain, apply=True))
    assert not rec["kept"] and "fresh check" in rec["rejected"][0]
    with db() as conn:
        assert row(conn, "SELECT markdown FROM chapters WHERE id=?", (lesson["id"],))["markdown"] == saved[lesson["id"]]


def test_by_default_a_correction_is_only_proposed_and_passing_checks_are_not_mistakes(client, course, monkeypatch):
    from app.agents import llm

    (lesson, _), saved = _two(course)
    md = saved[lesson["id"]] + "\n\nSo 3 × 4 = 13.\n"

    async def fake(*, system, user, schema, **_):
        if schema is VerifyOut:
            bad = "3 × 4 = 13" in user
            return VerifyOut(issues=["1.35^0.5 = 1.162, so 16.2% is right. This one checks out"]
                             + (["'3 × 4 = 13' should be 12"] if bad else [])), {}
        return Correction(markdown=md.replace("3 × 4 = 13", "3 × 4 = 12")), {}

    monkeypatch.setattr(llm, "parse", fake)

    async def call(system, user, schema, max_tokens):
        return (await llm.parse(system=system, user=user, schema=schema))[0]

    rec = asyncio.run(accuracy.correct(call, {"id": lesson["id"], "title": lesson["title"], "markdown": md, "questions": []}))
    assert rec["proposed"] and not rec["kept"] and "3 × 4 = 12" in rec["after"]["markdown"]
    assert all("checks out" not in i for i in rec["issues"])
    with db() as conn:
        assert row(conn, "SELECT markdown FROM chapters WHERE id=?", (lesson["id"],))["markdown"] == saved[lesson["id"]]
