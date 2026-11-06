"""Courses written by a coding agent: the folder check, the import (CLI and API), replace."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from app import authoring, cli

BODY = " ".join(
    f"Sentence {i} says one plain thing about counting items in a set without storing them all." for i in range(30)
)


def lesson(title: str) -> str:
    return f"# {title}\n\n{BODY}\n\n> **Key idea:** a plain summary.\n\n## What you have now\n\nA short close.\n"


def question(concept: str) -> dict:
    return {"prompt": "Which is true?", "options": ["One", "Two", "Three"], "answer": 1,
            "explanation": "Because two.", "conceptKeys": [concept]}


def make_course(root: Path, title: str = "Bloom filters from zero") -> Path:
    outline = {
        "title": title,
        "topic": "Bloom filters",
        "summary": "Learn how to answer membership questions with little memory.",
        "colour": "teal",
        "concepts": [
            {"key": "hash-function", "name": "Hash function", "summary": "Turns input into a number."},
            {"key": "bit-array", "name": "Bit array", "summary": "A row of zeros and ones."},
            {"key": "bloom-filter", "name": "Bloom filter", "summary": "Says maybe or surely not."},
        ],
        "edges": [{"from": "hash-function", "to": "bloom-filter"}, {"from": "bit-array", "to": "bloom-filter"}],
        "modules": [{
            "key": "basics", "title": "Answering membership questions cheaply", "summary": "The pieces.",
            "chapters": [
                {"key": "hash-function", "title": "Hash function: turning any input into a number",
                 "conceptKeys": ["hash-function"]},
                {"key": "bit-array", "title": "Bit array: a row of on and off switches",
                 "conceptKeys": ["bit-array"]},
                {"key": "bloom-filter", "title": "Bloom filter: a set that can say maybe",
                 "conceptKeys": ["bloom-filter"]},
            ],
        }],
    }
    (root / "chapters").mkdir(parents=True)
    (root / "outline.json").write_text(json.dumps(outline))
    for ch in outline["modules"][0]["chapters"]:
        (root / "chapters" / f"{ch['key']}.md").write_text(lesson(ch["title"]))
        (root / "chapters" / f"{ch['key']}.json").write_text(json.dumps({"questions": [question(ch["key"])]}))
    return root


def errors(report: authoring.Report) -> list[str]:
    return [str(i) for i in report.errors]


def test_a_good_folder_has_no_errors(tmp_path):
    report = authoring.check_folder(make_course(tmp_path / "c"), flow=False)
    assert errors(report) == []
    assert (report.title, report.modules, report.lessons) == ("Bloom filters from zero", 1, 3)
    # Teaching rules are warnings, not errors: a 3-lesson course is short.
    assert any("lessons; a course is usually" in i.message for i in report.warnings)


def test_every_problem_is_reported_with_its_file(tmp_path):
    folder = make_course(tmp_path / "c")
    outline = json.loads((folder / "outline.json").read_text())
    chs = outline["modules"][0]["chapters"]
    chs[0], chs[2] = chs[2], chs[0]  # the Bloom filter lesson now comes before its prerequisite
    (folder / "outline.json").write_text(json.dumps(outline))
    (folder / "chapters" / "bit-array.md").unlink()
    bad = question("bit-array") | {"answer": 7}
    (folder / "chapters" / "hash-function.json").write_text(json.dumps({"questions": [bad]}))
    (folder / "chapters" / "bloom-filter.json").write_text(
        json.dumps({"diagrams": [{"kind": "mermaid", "source": "not a diagram"}]})
    )
    (folder / "chapters" / "stray.md").write_text("# Stray\n")

    report = authoring.check_folder(folder, flow=False)
    paths = {i.path for i in report.errors}
    assert paths == {"outline.json", "chapters/bit-array.md", "chapters/hash-function.json", "chapters/bloom-filter.json"}
    assert any("before lesson hash-function teaches its prerequisite" in e for e in errors(report))
    assert any("answer index out of range" in e for e in errors(report))
    assert any(i.path == "chapters/stray.md" for i in report.warnings)
    assert not report.ok()


def test_a_broken_outline_stops_early_with_field_paths(tmp_path):
    folder = tmp_path / "c"
    folder.mkdir()
    (folder / "outline.json").write_text(json.dumps({"title": "X", "modules": [], "extra": 1}))
    report = authoring.check_folder(folder, flow=False)
    msgs = errors(report)
    assert any(m.startswith("outline.json: error: modules") for m in msgs)
    assert any("extra" in m for m in msgs)
    assert authoring.check_folder(tmp_path / "nothing", flow=False).errors[0].path == "outline.json"


def test_import_saves_a_ready_course_with_maps_and_replace_updates_it(client, tmp_path):
    from app.db import db, rows

    folder = make_course(tmp_path / "c", title="Authored import test")
    with db() as conn:
        course_id, created = authoring.import_folder(conn, folder)
    assert created
    detail = client.get(f"/api/courses/{course_id}").json()["data"]
    assert detail["status"] == "ready"
    first = detail["modules"][0]["chapters"][0]
    chapter = client.get(f"/api/chapters/{first['id']}").json()["data"]
    assert chapter["markdown"].startswith("# Hash function")
    assert [d["title"] for d in chapter["diagrams"]] == ["Your map so far"]
    assert len(chapter["questions"]) == 1

    with db() as conn, pytest.raises(authoring.ImportConflict):
        authoring.import_folder(conn, folder)

    (folder / "chapters" / "hash-function.md").write_text(lesson("Hash function: turning any input into a number") + "\nNew line.\n")
    with db() as conn:
        again, created = authoring.import_folder(conn, folder, replace=True)
        n = rows(conn, "SELECT COUNT(*) AS n FROM courses WHERE seed_key=?", (authoring.seed_key("Authored import test"),))
    assert (again, created) == (course_id, False)
    assert n[0]["n"] == 1
    detail = client.get(f"/api/courses/{course_id}").json()["data"]
    first = detail["modules"][0]["chapters"][0]
    assert "New line." in client.get(f"/api/chapters/{first['id']}").json()["data"]["markdown"]


def test_api_import(client, tmp_path):
    folder = make_course(tmp_path / "c", title="Authored over the API")
    files = authoring.read_bundle(folder)
    r = client.post("/api/courses/import", json={"files": files})
    assert r.status_code == 201, r.text
    data = r.json()["data"]
    assert data["created"] and data["course"]["chapterCount"] == 3
    assert any(c["id"] == data["course"]["id"] for c in client.get("/api/courses").json()["data"])

    assert client.post("/api/courses/import", json={"files": files}).status_code == 409
    assert client.post("/api/courses/import", json={"files": files, "replace": True}).status_code == 201
    strict = client.post("/api/courses/import", json={"files": files, "replace": True, "strict": True})
    assert strict.status_code == 422 and strict.json()["report"]["warnings"] > 0

    broken = dict(files)
    del broken["chapters/bit-array.md"]
    r = client.post("/api/courses/import", json={"files": broken})
    assert r.status_code == 422
    issues = r.json()["report"]["issues"]
    assert [i["path"] for i in issues if i["level"] == "error"] == ["chapters/bit-array.md"]

    r = client.post("/api/courses/import", json={"files": {**files, "../escape.md": "x"}})
    assert r.status_code == 422 and "../escape.md" in r.json()["message"]


def test_cli_check_exit_codes(tmp_path, capsys):
    folder = make_course(tmp_path / "c")
    assert cli.main(["check", str(folder), "--no-flow"]) == 0
    assert cli.main(["check", str(folder), "--no-flow", "--strict"]) == 1
    capsys.readouterr()
    assert cli.main(["check", str(folder), "--no-flow", "--json"]) == 0
    report = json.loads(capsys.readouterr().out)
    assert report["errors"] == 0 and report["lessons"] == 3
    (folder / "outline.json").unlink()
    assert cli.main(["check", str(folder), "--no-flow"]) == 1
    assert "outline.json: error: missing" in capsys.readouterr().out


def test_schema_lists_the_three_json_files():
    s = authoring.schemas()
    assert set(s) == {"outline.json", "chapters/<key>.json", "projects/<key>.json"}
    assert "from" in json.dumps(s["outline.json"])
