"""One notes page per chapter, nested under the course, created on first write; quotes append to it."""

from __future__ import annotations


def _first_chapter(course: dict) -> str:
    return course["modules"][0]["chapters"][0]["id"]


def test_chapter_note_is_created_once_and_appended(client, course):
    ch = course["modules"][1]["chapters"][0]["id"]
    assert client.get(f"/api/chapters/{ch}/note").json()["data"] is None  # opening the panel creates nothing

    # An older one-off "Add to notes" page for the same chapter is not the chapter's page.
    client.post("/api/notes", json={"title": "A quote", "markdown": "> old", "chapterId": ch})
    assert client.get(f"/api/chapters/{ch}/note").json()["data"] is None

    first = client.post(f"/api/chapters/{ch}/note", json={}).json()["data"]
    assert first["title"].startswith("Notes: ") and first["markdown"] == ""
    again = client.post(f"/api/chapters/{ch}/note", json={"append": "> Votes are granted once per term."}).json()["data"]
    assert again["id"] == first["id"] and again["markdown"].startswith("> Votes are granted once per term.")
    third = client.post(f"/api/chapters/{ch}/note", json={"append": "> Logs only grow."}).json()["data"]
    assert third["markdown"] == "> Votes are granted once per term.\n\n> Logs only grow.\n"
    assert client.get(f"/api/chapters/{ch}/note").json()["data"]["id"] == first["id"]

    # It nests under one page for the course, shared by every chapter's notes.
    other = client.post(f"/api/chapters/{_first_chapter(course)}/note", json={}).json()["data"]
    assert other["parentId"] == first["parentId"] and first["parentId"]
    parent = client.get(f"/api/notes/{first['parentId']}").json()["data"]
    assert parent["title"] == course["title"]


def test_chapter_note_unknown_chapter(client):
    assert client.get("/api/chapters/nope/note").status_code == 404
    assert client.post("/api/chapters/nope/note", json={}).status_code == 404
