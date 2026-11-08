"""Export a course as an EPUB 3 book.

The book is built on request and never stored. It holds a title page, one page per module, every lesson
as XHTML (markdown through markdown-it-py), the lesson's Inkling drawings as SVG pictures (their finished
frame, drawn by the vendored Inkling command line under Node, then turned into PNG with resvg and the bundled
Caveat font, because many readers, Kindle among them, show an SVG picture as a broken image), each Flowmovie diagram as its numbered
scene captions, the lesson's questions followed by their answers, and the module projects as an appendix.

Two loaders feed the same builder: `book_from_db` (a course in the database, for the web download) and
`book_from_folder` (a course folder, for `python -m app.cli export-epub`). Like app/inkling.py this module
never fails because Node is missing: a drawing it cannot draw becomes its title.
"""

from __future__ import annotations

import io
import json
import re
import sqlite3
import subprocess
import tempfile
import uuid
import zipfile
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import escape
from pathlib import Path

from markdown_it import MarkdownIt

from app import inkling
from app.flowmovie import node_bin
from app.rag.chunk import slugify

RENDER_TIMEOUT_SECONDS = 30
FONT = Path(__file__).resolve().parent.parent / "vendor" / "fonts" / "Caveat.ttf"
PNG_ZOOM = 1.5
LETTERS = "ABCDEF"


@dataclass
class BookQuestion:
    prompt: str
    options: list[str]
    answer: int
    explanation: str = ""


@dataclass
class BookDiagram:
    kind: str  # flow | mermaid | svg | graph
    title: str
    source: str


@dataclass
class BookLesson:
    title: str
    markdown: str
    questions: list[BookQuestion] = field(default_factory=list)
    diagrams: list[BookDiagram] = field(default_factory=list)


@dataclass
class BookProject:
    title: str
    brief: str = ""
    starter: list[dict] = field(default_factory=list)  # {path, note}
    hints: list[str] = field(default_factory=list)
    rubric: list[dict] = field(default_factory=list)  # {criterion, chapterKey?}
    milestones: list[dict] = field(default_factory=list)  # {title, body, checkCmd}


@dataclass
class BookModule:
    title: str
    summary: str = ""
    lessons: list[BookLesson] = field(default_factory=list)
    project: BookProject | None = None


@dataclass
class Book:
    id: str
    title: str
    summary: str = ""
    modules: list[BookModule] = field(default_factory=list)

    @property
    def lesson_count(self) -> int:
        return sum(len(m.lessons) for m in self.modules)

    @property
    def filename(self) -> str:
        return f"{slugify(self.title) or 'course'}.epub"


class NotReady(Exception):
    """The course has no written lessons yet."""


# ---------------------------------------------------------------- loaders


def book_from_db(conn: sqlite3.Connection, course_id: str) -> Book | None:
    course = conn.execute("SELECT id, title, summary, status FROM courses WHERE id=?", (course_id,)).fetchone()
    if not course:
        return None
    if course["status"] != "ready":
        raise NotReady(course["status"])
    book = Book(id=course["id"], title=course["title"], summary=course["summary"] or "")
    for m in conn.execute("SELECT id, title, summary FROM modules WHERE course_id=? ORDER BY position", (course_id,)):
        mod = BookModule(title=m["title"], summary=m["summary"] or "")
        for ch in conn.execute(
            "SELECT id, title, markdown FROM chapters WHERE module_id=? ORDER BY position", (m["id"],)
        ):
            lesson = BookLesson(title=ch["title"], markdown=ch["markdown"] or "")
            for q in conn.execute(
                "SELECT prompt, options, answer, explanation FROM questions WHERE chapter_id=? ORDER BY position",
                (ch["id"],),
            ):
                lesson.questions.append(
                    BookQuestion(q["prompt"], list(json.loads(q["options"] or "[]")), q["answer"], q["explanation"] or "")
                )
            for d in conn.execute(
                "SELECT kind, title, source FROM diagrams WHERE chapter_id=? ORDER BY position", (ch["id"],)
            ):
                lesson.diagrams.append(BookDiagram(d["kind"], d["title"] or "", d["source"]))
            mod.lessons.append(lesson)
        p = conn.execute(
            "SELECT id, title, brief, starter, hints, rubric FROM projects WHERE module_id=?", (m["id"],)
        ).fetchone()
        if p:
            milestones = [
                {"title": r["title"], "body": r["body"], "checkCmd": r["check_cmd"]}
                for r in conn.execute(
                    "SELECT title, body, check_cmd FROM milestones WHERE project_id=? ORDER BY position", (p["id"],)
                )
            ]
            mod.project = BookProject(
                title=p["title"],
                brief=p["brief"] or "",
                starter=_json_list(p["starter"]),
                hints=_json_list(p["hints"]),
                rubric=_json_list(p["rubric"]),
                milestones=milestones,
            )
        book.modules.append(mod)
    if book.lesson_count == 0:
        raise NotReady("no lessons")
    return book


def book_from_folder(folder: Path) -> Book:
    from app.materialise import parse_course_folder

    parsed = parse_course_folder(Path(folder))
    o = parsed.outline
    book = Book(id=f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, 'coursewright:' + o.title)}", title=o.title,
                summary=o.summary)
    for m in o.modules:
        mod = BookModule(title=m.title, summary=m.summary)
        for ch in m.chapters:
            ex = parsed.extras[ch.key]
            mod.lessons.append(
                BookLesson(
                    title=ch.title,
                    markdown=parsed.chapters[ch.key],
                    questions=[BookQuestion(q.prompt, list(q.options), q.answer, q.explanation) for q in ex.questions],
                    diagrams=[BookDiagram(d.kind, d.title, d.source) for d in ex.diagrams],
                )
            )
        if m.projectKey and m.projectKey in parsed.projects:
            spec = parsed.projects[m.projectKey].model_dump(by_alias=True)
            mod.project = BookProject(
                title=spec.get("title", ""),
                brief=spec.get("brief", ""),
                starter=spec.get("starter", []),
                hints=spec.get("hints", []),
                rubric=spec.get("rubric", []),
                milestones=spec.get("milestones", []),
            )
        book.modules.append(mod)
    return book


def _json_list(text: str | None) -> list:
    try:
        v = json.loads(text or "[]")
    except json.JSONDecodeError:
        return []
    return v if isinstance(v, list) else []


# ---------------------------------------------------------------- drawing


def render_inkling(source: str, id_prefix: str) -> str | None:
    """The drawing's finished frame as SVG text, or None when Node is missing or the source does not draw."""
    node = node_bin()
    if not node or not inkling.CLI.exists():
        return None
    # Written to a file, not stdout: on Linux the CLI exits before a piped stdout drains, which cut drawings
    # off at 8 or 16 KB and left invalid SVG.
    with tempfile.TemporaryDirectory() as tmp:
        out_file = Path(tmp) / "drawing.svg"
        try:
            p = subprocess.run(
                [node, str(inkling.CLI), "render", "-", "-o", str(out_file), "--font-css", "none",
                 "--id-prefix", id_prefix, "--quiet"],
                input=source, capture_output=True, text=True, timeout=RENDER_TIMEOUT_SECONDS,
            )
        except (subprocess.TimeoutExpired, OSError):
            return None
        out = out_file.read_text().strip() if out_file.exists() else ""
    return out if p.returncode == 0 and out.startswith("<?xml") and out.endswith("</svg>") else None


def svg_to_png(svg: str) -> bytes | None:
    """The drawing as PNG in its own hand font, or None when it cannot be converted (the SVG is kept)."""
    try:
        import resvg_py

        fonts = [str(FONT)] if FONT.exists() else None
        return bytes(resvg_py.svg_to_bytes(svg_string=svg, font_files=fonts, cursive_family="Caveat", zoom=PNG_ZOOM))
    except Exception:  # noqa: BLE001 - a drawing that does not convert stays an SVG
        return None


_SCENE = re.compile(r"^Scene \d+ \([^)]*\): (?P<caption>.+)$", re.M)


def flow_steps(source: str) -> list[str]:
    """A Flowmovie diagram's scene captions, in order (empty when Node is missing)."""
    from app.flowmovie import story

    try:
        return [m["caption"].strip() for m in _SCENE.finditer(story(source) or "")]
    except Exception:  # noqa: BLE001 - a diagram that cannot be read back is left as its title
        return []


# ---------------------------------------------------------------- XHTML

_MD = MarkdownIt("commonmark", {"html": False, "xhtmlOut": True, "typographer": False}).enable("table")
_PLACEHOLDER = "INKLINGDRAWING{}X"


def _page(title: str, body: str) -> str:
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n<!DOCTYPE html>\n'
        '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">\n'
        f'<head><meta charset="utf-8"/><title>{escape(title)}</title>'
        '<link rel="stylesheet" type="text/css" href="style.css"/></head>\n'
        f"<body>\n{body}\n</body>\n</html>\n"
    )


def lesson_body(lesson: BookLesson, drawings: list[str | None], images: list[str]) -> str:
    """The lesson as XHTML. `drawings[i]` is the i-th Inkling fence's SVG (or None); `images[i]` its file name."""
    md = lesson.markdown
    fences = inkling.fences(md)
    titles = []
    for i, f in enumerate(reversed(fences)):
        n = len(fences) - 1 - i
        md = md[: f.start] + "\n\n" + _PLACEHOLDER.format(n) + "\n\n" + md[f.end:]
    titles = [f.title for f in fences]
    html = _MD.render(md)
    for n, title in enumerate(titles):
        caption = escape(title or "Drawing")
        if drawings[n]:
            figure = (f'<figure class="drawing"><img src="images/{images[n]}" alt="{caption}"/>'
                      f"<figcaption>{caption}</figcaption></figure>")
        else:
            figure = f'<p class="drawing-missing">Drawing: {caption}</p>'
        html = html.replace(f"<p>{_PLACEHOLDER.format(n)}</p>", figure)
    parts = [html]
    for d in lesson.diagrams:
        parts.append(diagram_block(d))
    if lesson.questions:
        parts.append(questions_block(lesson.questions))
    return "\n".join(parts)


def diagram_block(d: BookDiagram) -> str:
    title = escape(d.title or "Diagram")
    if d.kind == "flow":
        steps = flow_steps(d.source)
        items = "".join(f"<li>{escape(s)}</li>" for s in steps)
        body = f"<ol>{items}</ol>" if items else "<p>This animated diagram plays in the online course.</p>"
        return f'<section class="diagram"><h2>Diagram: {title}</h2><p class="note">Step by step:</p>{body}</section>'
    return (f'<section class="diagram"><h2>Diagram: {title}</h2>'
            "<p>This diagram is shown in the online course.</p></section>")


def questions_block(questions: list[BookQuestion]) -> str:
    asked, answers = [], []
    for i, q in enumerate(questions, 1):
        opts = "".join(f"<li>{escape(o)}</li>" for o in q.options)
        asked.append(f'<li><p>{escape(q.prompt)}</p><ol class="options" type="A">{opts}</ol></li>')
        letter = LETTERS[q.answer] if 0 <= q.answer < len(LETTERS) else "?"
        chosen = escape(q.options[q.answer]) if 0 <= q.answer < len(q.options) else ""
        why = f" {escape(q.explanation)}" if q.explanation else ""
        answers.append(f"<li><p><strong>{letter}. {chosen}</strong>{why}</p></li>")
    return (
        '<section class="check"><h2>Check yourself</h2>'
        f'<ol>{"".join(asked)}</ol>'
        f'<h3>Answers</h3><ol class="answers">{"".join(answers)}</ol></section>'
    )


def project_body(module_title: str, p: BookProject) -> str:
    out = [f"<h1>{escape(p.title)}</h1>", f'<p class="note">Project for “{escape(module_title)}”</p>']
    if p.brief:
        out.append(f"<p>{escape(p.brief)}</p>")
    if p.starter:
        items = "".join(
            f"<li><code>{escape(str(s.get('path', '')))}</code>: {escape(str(s.get('note', '')))}</li>" for s in p.starter
        )
        out.append(f"<h2>Starter files</h2><ul>{items}</ul>")
    if p.milestones:
        items = []
        for m in p.milestones:
            cmd = m.get("checkCmd") or m.get("check_cmd") or ""
            check = f"<p>Check: <code>{escape(cmd)}</code></p>" if cmd else ""
            items.append(f"<li><p><strong>{escape(str(m.get('title', '')))}</strong></p>"
                         f"<p>{escape(str(m.get('body', '')))}</p>{check}</li>")
        out.append(f"<h2>Milestones</h2><ol>{''.join(items)}</ol>")
    if p.hints:
        out.append("<h2>Hints</h2><ul>" + "".join(f"<li>{escape(str(h))}</li>" for h in p.hints) + "</ul>")
    if p.rubric:
        out.append(
            "<h2>What a finished project does</h2><ul>"
            + "".join(f"<li>{escape(str(r.get('criterion', r) if isinstance(r, dict) else r))}</li>" for r in p.rubric)
            + "</ul>"
        )
    return "\n".join(out)


STYLE = """body { font-family: serif; line-height: 1.5; margin: 0 1em; }
h1 { font-size: 1.6em; margin: 1em 0 0.6em; }
h2 { font-size: 1.25em; margin: 1.4em 0 0.5em; }
h3 { font-size: 1.1em; }
pre { white-space: pre-wrap; font-size: 0.85em; background: #f4f4f0; padding: 0.6em; border-radius: 4px; }
code { font-family: monospace; font-size: 0.9em; }
blockquote { margin: 1em 0; padding-left: 1em; border-left: 3px solid #999; }
figure.drawing { margin: 1.2em 0; text-align: center; }
figure.drawing img { max-width: 100%; height: auto; }
figcaption, .note { font-size: 0.9em; color: #555; font-style: italic; }
table { border-collapse: collapse; } th, td { border: 1px solid #bbb; padding: 0.3em 0.5em; }
section.check { margin-top: 2em; border-top: 1px solid #ccc; }
ol.options { list-style-type: upper-alpha; }
.title-page { text-align: center; margin-top: 30%; }
"""


# ---------------------------------------------------------------- package


def build_epub(book: Book, *, render=render_inkling, to_png=svg_to_png) -> bytes:
    """The whole book as EPUB 3 bytes (with an EPUB 2 toc.ncx for older readers)."""
    files: list[tuple[str, str, str | bytes, str]] = []  # (href, media type, content, id)
    spine: list[str] = []
    nav_modules: list[tuple[str, str, list[tuple[str, str]]]] = []

    # Draw every Inkling fence first, a few at a time.
    jobs = []
    for mi, m in enumerate(book.modules):
        for li, lesson in enumerate(m.lessons):
            for di, f in enumerate(inkling.fences(lesson.markdown)):
                jobs.append(((mi, li, di), f.source, f"m{mi}l{li}d{di}-"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        drawn = dict(zip([j[0] for j in jobs], pool.map(lambda j: render(j[1], j[2]), jobs)))
        keys = [k for k, v in drawn.items() if v]
        pngs = dict(zip(keys, pool.map(lambda k: to_png(drawn[k]), keys))) if to_png else {}

    stats = f"{len(book.modules)} modules · {book.lesson_count} lessons"
    title_body = (f'<section class="title-page" epub:type="titlepage"><h1>{escape(book.title)}</h1>'
                  f"<p>{escape(book.summary)}</p><p class=\"note\">{stats}</p></section>")
    files.append(("title.xhtml", "application/xhtml+xml", _page(book.title, title_body), "title"))
    spine.append("title")

    for mi, m in enumerate(book.modules):
        mod_href = f"module-{mi + 1:02d}.xhtml"
        lesson_links = []
        lesson_list = "".join(f"<li>{escape(lesson.title)}</li>" for lesson in m.lessons)
        mod_body = (f"<h1>Module {mi + 1}. {escape(m.title)}</h1><p>{escape(m.summary)}</p>"
                    f"<ol>{lesson_list}</ol>")
        files.append((mod_href, "application/xhtml+xml", _page(m.title, mod_body), f"module{mi + 1}"))
        spine.append(f"module{mi + 1}")
        for li, lesson in enumerate(m.lessons):
            n = len(inkling.fences(lesson.markdown))
            svgs = [drawn.get((mi, li, di)) for di in range(n)]
            images = []
            for di, svg in enumerate(svgs):
                stem = f"m{mi + 1:02d}-l{li + 1:02d}-{di + 1}"
                png = pngs.get((mi, li, di))
                if png:
                    images.append(f"{stem}.png")
                    files.append((f"images/{stem}.png", "image/png", png, f"img-{mi + 1}-{li + 1}-{di + 1}"))
                else:
                    images.append(f"{stem}.svg")
                    if svg:
                        files.append((f"images/{stem}.svg", "image/svg+xml", svg, f"img-{mi + 1}-{li + 1}-{di + 1}"))
            href = f"lesson-{mi + 1:02d}-{li + 1:02d}.xhtml"
            lid = f"lesson{mi + 1}-{li + 1}"
            files.append((href, "application/xhtml+xml", _page(lesson.title, lesson_body(lesson, svgs, images)), lid))
            spine.append(lid)
            lesson_links.append((href, lesson.title))
        nav_modules.append((mod_href, f"{mi + 1}. {m.title}", lesson_links))

    projects = [(m.title, m.project) for m in book.modules if m.project]
    project_links = []
    if projects:
        files.append(("projects.xhtml", "application/xhtml+xml",
                      _page("Projects", "<h1>Projects</h1><p>One hands-on project for each module that has one.</p>"),
                      "projects"))
        spine.append("projects")
        for pi, (mt, p) in enumerate(projects, 1):
            href = f"project-{pi:02d}.xhtml"
            files.append((href, "application/xhtml+xml", _page(p.title, project_body(mt, p)), f"project{pi}"))
            spine.append(f"project{pi}")
            project_links.append((href, p.title))

    files.append(("nav.xhtml", "application/xhtml+xml", _nav(book, nav_modules, project_links), "nav"))
    files.append(("toc.ncx", "application/x-dtbncx+xml", _ncx(book, nav_modules, project_links), "ncx"))
    files.append(("style.css", "text/css", STYLE, "css"))

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr(zipfile.ZipInfo("mimetype"), "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        z.writestr(
            "META-INF/container.xml",
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">'
            '<rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>'
            "</rootfiles></container>\n",
            compress_type=zipfile.ZIP_DEFLATED,
        )
        z.writestr("OEBPS/content.opf", _opf(book, files, spine), compress_type=zipfile.ZIP_DEFLATED)
        for href, _media, content, _id in files:
            z.writestr(f"OEBPS/{href}", content, compress_type=zipfile.ZIP_DEFLATED)
    return buf.getvalue()


def _identifier(book: Book) -> str:
    return book.id if book.id.startswith("urn:") else f"urn:uuid:{uuid.uuid5(uuid.NAMESPACE_URL, 'coursewright:' + book.id)}"


def _opf(book: Book, files, spine) -> str:
    modified = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    items = []
    for href, media, _content, fid in files:
        props = ' properties="nav"' if fid == "nav" else ""
        items.append(f'<item id="{fid}" href="{href}" media-type="{media}"{props}/>')
    refs = "".join(f'<itemref idref="{i}"/>' for i in spine)
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="en">\n'
        '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">'
        f'<dc:identifier id="bookid">{escape(_identifier(book))}</dc:identifier>'
        f"<dc:title>{escape(book.title)}</dc:title><dc:language>en</dc:language>"
        "<dc:creator>Coursewright</dc:creator>"
        f'<dc:description>{escape(book.summary)}</dc:description>'
        f'<meta property="dcterms:modified">{modified}</meta></metadata>\n'
        f'<manifest>{"".join(items)}</manifest>\n'
        f'<spine toc="ncx">{refs}</spine>\n</package>\n'
    )


def _nav(book: Book, modules, project_links) -> str:
    lis = []
    for href, title, lessons in modules:
        sub = "".join(f'<li><a href="{h}">{escape(t)}</a></li>' for h, t in lessons)
        lis.append(f'<li><a href="{href}">{escape(title)}</a><ol>{sub}</ol></li>')
    if project_links:
        sub = "".join(f'<li><a href="{h}">{escape(t)}</a></li>' for h, t in project_links)
        lis.append(f'<li><a href="projects.xhtml">Projects</a><ol>{sub}</ol></li>')
    body = (f'<nav epub:type="toc" id="toc"><h1>Contents</h1><ol>'
            f'<li><a href="title.xhtml">{escape(book.title)}</a></li>{"".join(lis)}</ol></nav>')
    return _page("Contents", body)


def _ncx(book: Book, modules, project_links) -> str:
    order = 0
    points = []

    def point(href: str, title: str, children: str = "") -> str:
        nonlocal order
        order += 1
        return (f'<navPoint id="np{order}" playOrder="{order}"><navLabel><text>{escape(title)}</text></navLabel>'
                f'<content src="{href}"/>{children}</navPoint>')

    points.append(point("title.xhtml", book.title))
    for href, title, lessons in modules:
        head = point(href, title)
        kids = "".join(point(h, t) for h, t in lessons)
        points.append(head.replace("</navPoint>", kids + "</navPoint>", 1) if kids else head)
    if project_links:
        head = point("projects.xhtml", "Projects")
        kids = "".join(point(h, t) for h, t in project_links)
        points.append(head.replace("</navPoint>", kids + "</navPoint>", 1))
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">'
        f'<head><meta name="dtb:uid" content="{escape(_identifier(book))}"/></head>'
        f"<docTitle><text>{escape(book.title)}</text></docTitle>"
        f'<navMap>{"".join(points)}</navMap></ncx>\n'
    )
