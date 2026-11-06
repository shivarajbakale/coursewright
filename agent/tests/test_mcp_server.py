"""The MCP server, driven by a real MCP client in-process: rules, the save tools, check, import."""

from __future__ import annotations

import asyncio
import json

from mcp.client import Client

from app.mcp_server import mcp
from tests.test_authoring import lesson, make_course, question


def run(coro):
    return asyncio.run(coro)


async def call(client, name, **args):
    r = await client.call_tool(name, args)
    if r.is_error:
        return {"toolError": " ".join(getattr(c, "text", "") for c in r.content)}
    if r.structured_content is not None:
        sc = r.structured_content
        return sc.get("result", sc) if set(sc) == {"result"} else sc
    return json.loads(r.content[0].text) if r.content and r.content[0].text.startswith(("{", "[")) else r.content[0].text


def test_rules_are_exposed_as_tools_resources_and_a_prompt():
    async def go():
        async with Client(mcp) as c:
            tools = {t.name for t in (await c.list_tools()).tools}
            assert {"get_guide", "get_rules", "get_schema", "start_course", "save_outline", "save_lesson",
                    "save_diagram", "save_project", "read_course", "list_courses", "check_course",
                    "import_course", "check_diagram"} <= tools
            assert "one concept per lesson" in (await call(c, "get_rules", stage="curriculum")).lower()
            assert "# Writing a course with a coding agent" in await call(c, "get_guide")
            uris = {str(r.uri) for r in (await c.list_resources()).resources}
            assert {"coursewright://guide", "coursewright://rules/writer", "coursewright://rules/diagrammer"} <= uris
            text = (await c.read_resource("coursewright://rules/quiz")).contents[0].text
            assert "check-yourself questions" in text
            prompt = await c.get_prompt("write-course", {"topic": "Bloom filters"})
            assert "save_outline" in prompt.messages[0].content.text

    run(go())


def test_write_check_and_import_a_course_through_mcp(client, tmp_path, monkeypatch):
    monkeypatch.setenv("CW_COURSES_DIR", str(tmp_path))
    src = make_course(tmp_path / "_src", title="Authored over MCP")
    outline = json.loads((src / "outline.json").read_text())

    async def go():
        async with Client(mcp) as c:
            assert "toolError" in await call(c, "start_course", slug="../escape", topic="x", goal="y")
            assert (await call(c, "start_course", slug="bloom", topic="Bloom filters", goal="build one"))["folder"]
            bad = await call(c, "save_outline", slug="bloom", outline={"title": "X", "modules": []})
            assert bad["saved"] is False and bad["errors"]
            saved = await call(c, "save_outline", slug="bloom", outline=outline)
            assert saved["saved"] and saved["lessonsToWrite"] == ["hash-function", "bit-array", "bloom-filter"]

            nope = await call(c, "save_lesson", slug="bloom", key="nope", markdown="# x")
            assert nope["saved"] is False
            wrong = await call(c, "save_lesson", slug="bloom", key="bit-array", markdown="# x",
                               questions=[question("bit-array") | {"answer": 9}])
            assert wrong["saved"] is False and any("answer index" in e for e in wrong["errors"])

            for ch in outline["modules"][0]["chapters"]:
                r = await call(c, "save_lesson", slug="bloom", key=ch["key"], markdown=lesson(ch["title"]),
                               questions=[question(ch["key"])])
                assert r["saved"] and r["errors"] == 0, r

            refused = await call(c, "save_diagram", slug="bloom", key="bloom-filter", kind="mermaid", source="nonsense")
            assert refused["saved"] is False
            ok = await call(c, "save_diagram", slug="bloom", key="bloom-filter", kind="mermaid",
                            source="flowchart LR\n  a[Item] --> b[Bits]\n")
            assert ok["saved"] and ok["errors"] == 0

            listed = await call(c, "list_courses")
            assert [x["slug"] for x in listed if x["slug"] == "bloom"] and next(
                x for x in listed if x["slug"] == "bloom")["written"] == 3
            check = await call(c, "check_course", slug="bloom")
            assert check["ok"] and check["errors"] == 0
            read = await call(c, "read_course", slug="bloom", lesson="bit-array")
            assert read["lesson"]["markdown"].startswith("# Bit array")

            imported = await call(c, "import_course", slug="bloom")
            assert imported["ok"] and imported["created"], imported
            again = await call(c, "import_course", slug="bloom")
            assert again["ok"] is False and "replace" in again["message"]
            return imported["courseId"]

    course_id = run(go())
    detail = client.get(f"/api/courses/{course_id}").json()["data"]
    assert detail["title"] == "Authored over MCP" and detail["status"] == "ready"
