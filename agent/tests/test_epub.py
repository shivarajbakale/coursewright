"""Export a course as an EPUB 3 book: the package rules, the lesson pages, the route and the CLI."""

from __future__ import annotations

import io
import re
import shutil
import xml.dom.minidom
import zipfile
from pathlib import Path

from app import cli, epub
from app.db import db, new_id, now

from .conftest import FIXTURES

FAKE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'
OPF_NS = "http://www.idpf.org/2007/opf"


def fake_render(source: str, prefix: str) -> str:
    return FAKE_SVG


def folder_with_drawing(tmp_path: Path) -> Path:
    folder = tmp_path / "course"
    shutil.copytree(FIXTURES / "course_min", folder)
    md = folder / "chapters" / "c01-hashing.md"
    text = md.read_text().rstrip() + (
        '\n\nA paragraph after which the drawing sits, long enough to be found.\n\n'
        '```inkling\ntitle "Hash to bucket"\na: box "Key"\nb: box "Bucket"\na -> b\n'
        'step 1: a "A key"\nstep 2: b "Lands in a bucket"\n```\n\nThe last paragraph & a <tag>.\n'
    )
    md.write_text(text)
    return folder


def open_book(data: bytes) -> zipfile.ZipFile:
    return zipfile.ZipFile(io.BytesIO(data))


def test_package_follows_the_epub_rules(tmp_path):
    book = epub.book_from_folder(folder_with_drawing(tmp_path))
    z = open_book(epub.build_epub(book, render=fake_render))
    names = z.namelist()
    # mimetype first, stored, exact content
    assert names[0] == "mimetype"
    assert z.getinfo("mimetype").compress_type == zipfile.ZIP_STORED
    assert z.read("mimetype") == b"application/epub+zip"
    assert "META-INF/container.xml" in names
    # every XML file is well-formed
    for n in names:
        if n.endswith((".xhtml", ".opf", ".ncx", ".xml", ".svg")):
            xml.dom.minidom.parseString(z.read(n))
    opf = xml.dom.minidom.parseString(z.read("OEBPS/content.opf"))
    items = {i.getAttribute("id"): i.getAttribute("href") for i in opf.getElementsByTagNameNS(OPF_NS, "item")}
    # the manifest lists every file, and nothing that is not there
    packaged = {n.removeprefix("OEBPS/") for n in names if n.startswith("OEBPS/") and n != "OEBPS/content.opf"}
    assert set(items.values()) == packaged
    nav = [i for i in opf.getElementsByTagNameNS(OPF_NS, "item") if i.getAttribute("properties") == "nav"]
    assert len(nav) == 1
    # the spine points only at listed items
    spine = [r.getAttribute("idref") for r in opf.getElementsByTagNameNS(OPF_NS, "itemref")]
    assert spine and all(s in items for s in spine)
    # every link and image in every page resolves to a packaged file
    for n in names:
        if n.endswith(".xhtml"):
            for ref in re.findall(r'(?:href|src)="([^"#]+)', z.read(n).decode()):
                assert ref in packaged, (n, ref)


def test_lessons_drawings_questions_and_projects(tmp_path):
    book = epub.book_from_folder(folder_with_drawing(tmp_path))
    z = open_book(epub.build_epub(book, render=fake_render))
    nav = z.read("OEBPS/nav.xhtml").decode()
    for m in book.modules:
        for lesson in m.lessons:
            assert lesson.title.replace("'", "&#x27;") in nav or lesson.title in nav
    first = z.read("OEBPS/lesson-01-01.xhtml").decode()
    # drawings ship as PNG: many readers (Kindle among them) show an SVG picture as a broken image
    assert '<img src="images/m01-l01-1.png" alt="Hash to bucket"/>' in first
    png = z.read("OEBPS/images/m01-l01-1.png")
    assert png.startswith(b"\x89PNG")
    assert "```inkling" not in first and "step 1:" not in first
    assert "&amp; a &lt;tag&gt;" in first  # text is escaped, raw HTML is not passed through
    assert "Check yourself" in first and "Answers" in first
    q = book.modules[0].lessons[0].questions[0]
    assert q.options[q.answer] in first
    assert "Projects" in nav
    assert any(n.startswith("OEBPS/project-") for n in z.namelist())


def test_drawing_stays_svg_when_it_cannot_become_png(tmp_path):
    book = epub.book_from_folder(folder_with_drawing(tmp_path))
    z = open_book(epub.build_epub(book, render=fake_render, to_png=lambda svg: None))
    assert '<img src="images/m01-l01-1.svg"' in z.read("OEBPS/lesson-01-01.xhtml").decode()
    assert "OEBPS/images/m01-l01-1.svg" in z.namelist()


def test_real_drawing_text_uses_the_bundled_hand_font():
    assert epub.FONT.exists()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60">'
        "<text x=\"10\" y=\"40\" font-family=\"'Caveat', cursive\" font-size=\"30\">Hello</text></svg>"
    )
    png = epub.svg_to_png(svg)
    assert png and png.startswith(b"\x89PNG")
    blank = epub.svg_to_png('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"></svg>')
    assert blank and len(png) > len(blank)  # the text was drawn, not dropped for want of a font


def test_drawing_without_node_becomes_its_title(tmp_path):
    book = epub.book_from_folder(folder_with_drawing(tmp_path))
    z = open_book(epub.build_epub(book, render=lambda s, p: None))
    first = z.read("OEBPS/lesson-01-01.xhtml").decode()
    assert "Drawing: Hash to bucket" in first
    assert not any(n.endswith((".svg", ".png")) for n in z.namelist())


def test_flow_diagram_becomes_its_scene_captions(monkeypatch):
    from app import flowmovie

    monkeypatch.setattr(
        flowmovie, "story",
        lambda s: "Title\n\nScene 1 (0.0s-2.0s): The request starts.\n    0.0s  x\nScene 2 (2.0s-4.0s): The answer returns.\n",
    )
    block = epub.diagram_block(epub.BookDiagram("flow", "Round trip", "ignored"))
    assert "<li>The request starts.</li><li>The answer returns.</li>" in block


def test_route_downloads_a_ready_course(client, course):
    r = client.get(f"/api/courses/{course['id']}/export.epub")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/epub+zip"
    assert re.match(r'attachment; filename="[a-z0-9-]+\.epub"', r.headers["content-disposition"])
    z = open_book(r.content)
    assert z.namelist()[0] == "mimetype"
    assert sum(n.startswith("OEBPS/lesson-") for n in z.namelist()) == course["chapterCount"]


def test_route_unknown_and_unready_courses(client):
    assert client.get("/api/courses/nope/export.epub").status_code == 404
    cid = new_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO courses (id, title, slug, topic, status, created_at) VALUES (?,?,?,?,?,?)",
            (cid, "Half written", "half-written", "x", "building", now()),
        )
        conn.commit()
    assert client.get(f"/api/courses/{cid}/export.epub").status_code == 409


def test_cli_export(tmp_path, capsys):
    out = tmp_path / "book.epub"
    assert cli.main(["export-epub", str(FIXTURES / "course_min"), "-o", str(out)]) == 0
    assert out.exists() and open_book(out.read_bytes()).namelist()[0] == "mimetype"
    assert "Wrote" in capsys.readouterr().out


def test_a_large_drawing_is_rendered_whole():
    """The CLI writes to a file: a piped stdout was cut at 8 or 16 KB on Linux, leaving invalid SVG."""
    import pytest

    from app.flowmovie import node_bin

    if not node_bin():
        pytest.skip("node is not installed")
    boxes = "\n".join(f'b{i}: box "Box number {i}"' for i in range(9))
    arrows = "\n".join(f"b{i} -> b{i + 1}" for i in range(8))
    steps = "\n".join(f'step {i + 1}: b{i} "Step {i + 1}"' for i in range(6))
    svg = epub.render_inkling(f'title "A long chain"\nlayout down\n{boxes}\n{arrows}\n{steps}', "t-")
    assert svg and len(svg) > 16384 and svg.endswith("</svg>")
    xml.dom.minidom.parseString(svg)
