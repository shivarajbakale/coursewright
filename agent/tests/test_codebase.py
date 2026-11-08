"""The tutor reads a GitHub codebase: repo links, the tree, numbered reads, tree-sitter outlines, search and
definitions. GitHub is a fake (httpx.MockTransport): no network."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest

from app import code_outline, codebase

AGENT_TS = """import { x } from "./x";

export interface Opts { limit: number }

export class Agent {
  constructor(private opts: Opts) {}
  async run(prompt: string) {
    return runLoop(prompt);
  }
}

export async function runLoop(prompt: string) {
  // finishTurn may end the run
  return prompt;
}

const helper = () => 1;
"""
TOOLS_PY = '''class Registry:
    def add(self, tool):
        """finishTurn is not here"""
        return tool


def build():
    return Registry()
'''
FILES = {"src/agent.ts": AGENT_TS, "src/tools.py": TOOLS_PY, "README.md": "# Demo\nCall runLoop to start.\n",
         "logo.png": "\x00PNG"}


@pytest.fixture
def github(monkeypatch):
    calls: list[str] = []

    def handle(req: httpx.Request) -> httpx.Response:
        calls.append(f"{req.url.host}{req.url.path}")
        path = req.url.path
        if req.url.host == "api.github.com":
            if path == "/repos/acme/demo":
                return httpx.Response(200, json={"default_branch": "trunk"})
            if path == "/repos/acme/demo/git/trees/trunk":
                tree = [{"path": "src", "type": "tree"}]
                tree += [{"path": p, "type": "blob", "size": len(t)} for p, t in FILES.items()]
                return httpx.Response(200, json={"tree": tree, "truncated": False})
            if path == "/repos/acme/limited":
                return httpx.Response(403, headers={"x-ratelimit-remaining": "0"})
            return httpx.Response(404)
        if req.url.host == "raw.githubusercontent.com" and path.startswith("/acme/demo/trunk/"):
            name = path.removeprefix("/acme/demo/trunk/")
            if name in FILES:
                return httpx.Response(200, content=FILES[name].encode())
        return httpx.Response(404)

    monkeypatch.setattr(codebase, "transport", httpx.MockTransport(handle))
    monkeypatch.setattr(codebase, "_trees", {})
    monkeypatch.setattr(codebase, "_files", __import__("collections").OrderedDict())
    monkeypatch.setattr(codebase.config, "github_token", lambda: None)
    return calls


def run(coro):
    return asyncio.run(coro)


def test_repo_links_are_read_in_every_form():
    assert codebase.parse_repo("acme/demo") == codebase.RepoRef("acme", "demo")
    assert codebase.parse_repo("https://github.com/acme/demo.git") == codebase.RepoRef("acme", "demo")
    assert codebase.parse_repo("github.com/acme/demo/tree/dev/src/core") == codebase.RepoRef("acme", "demo", "dev", "src/core")
    assert codebase.parse_repo("https://github.com/acme/demo/blob/main/a/b.py#L3") == codebase.RepoRef("acme", "demo", "main", "a/b.py")
    for bad in ("demo", "https://gitlab.com/acme/demo", "acme/demo/extra"):
        with pytest.raises(codebase.CodebaseError):
            codebase.parse_repo(bad)


def test_tree_lists_folders_with_counts_and_caches_the_index(github):
    t = run(codebase.tree("https://github.com/acme/demo"))
    assert t["ref"] == "trunk" and t["entries"] == ["src/ (2 files)", "README.md", "logo.png"]
    assert run(codebase.tree("acme/demo", "src"))["entries"] == ["agent.ts", "tools.py"]
    assert sum("api.github.com" in c for c in github) == 2  # metadata and tree, once
    with pytest.raises(codebase.CodebaseError, match="no folder"):
        run(codebase.tree("acme/demo", "lib"))


def test_read_numbers_lines_and_links_to_them(github):
    r = run(codebase.read_file("acme/demo", "agent.ts", 12, 14))
    assert r["path"] == "src/agent.ts" and r["totalLines"] == AGENT_TS.count("\n")
    assert r["text"].splitlines()[0] == "12\texport async function runLoop(prompt: string) {"
    assert r["url"] == "https://github.com/acme/demo/blob/trunk/src/agent.ts#L12-L14"
    with pytest.raises(codebase.CodebaseError, match="binary"):
        run(codebase.read_file("acme/demo", "logo.png"))
    with pytest.raises(codebase.CodebaseError, match="no file"):
        run(codebase.read_file("acme/demo", "nope.ts"))


def test_outline_by_tree_sitter(github):
    o = run(codebase.outline("acme/demo", "src/agent.ts"))
    names = [(s["name"], s["kind"], s["line"]) for s in o["symbols"]]
    assert names == [("Opts", "interface", 3), ("Agent", "class", 5), ("Agent.constructor", "method", 6),
                     ("Agent.run", "method", 7), ("runLoop", "function", 12), ("helper", "function", 17)]
    py = [(s["name"], s["depth"]) for s in code_outline.outline("t.py", TOOLS_PY)]
    assert py == [("Registry", 0), ("Registry.add", 1), ("build", 0)]
    with pytest.raises(codebase.CodebaseError, match="No outline"):
        run(codebase.outline("acme/demo", "README.md"))


def test_search_and_find_definition(github):
    s = run(codebase.search("acme/demo", "finishturn"))
    assert [(h["path"], h["line"]) for h in s["hits"]] == [("src/agent.ts", 13), ("src/tools.py", 3)]
    assert run(codebase.search("acme/demo", "runLoop", "src"))["filesInScope"] == 2
    d = run(codebase.find_definition("acme/demo", "Agent.run"))
    assert [(x["path"], x["line"], x["kind"]) for x in d["definitions"]] == [("src/agent.ts", 7, "method")]
    assert run(codebase.find_definition("acme/demo", "nothingLikeThis"))["note"]


def test_tutor_tools_turn_problems_into_plain_errors(github):
    from app.agents import tutor

    assert {t.name for t in tutor.CODE_TOOLS} <= {t.name for t in tutor.TOOLS}
    out = json.loads(run(tutor.repo_tree.coroutine("acme/limited")))
    assert "rate limit" in out["error"]
    out = json.loads(run(tutor.read_repo_file.coroutine("acme/missing", "a.py")))
    assert "not found" in out["error"]
    ok = json.loads(run(tutor.file_outline.coroutine("acme/demo", "tools.py")))
    assert ok["symbols"][0]["name"] == "Registry"


def test_a_read_range_out_of_order_is_refused(github):
    with pytest.raises(codebase.CodebaseError, match="before start_line"):
        run(codebase.read_file("acme/demo", "agent.ts", 10, 5))
    with pytest.raises(codebase.CodebaseError, match="past the end"):
        run(codebase.read_file("acme/demo", "agent.ts", 500))


def test_the_tutor_stops_looking_after_ten_looks(github):
    from types import SimpleNamespace

    from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

    from app.agents import tutor

    def state(n: int) -> SimpleNamespace:
        msgs = [HumanMessage("earlier"), *[ToolMessage("x", tool_call_id=f"o{i}", name="read_repo_file") for i in range(9)],
                HumanMessage("how does it end a run?"), AIMessage("looking")]
        msgs += [ToolMessage("x", tool_call_id=f"t{i}", name="search_repo") for i in range(n)]
        msgs += [ToolMessage("x", tool_call_id="d", name="make_drawing")]
        return SimpleNamespace(state={"messages": msgs}, context=None)

    assert tutor.code_looks(state(9)) == 9  # looks before the learner's last message don't count
    assert "src/" in run(tutor.repo_tree.coroutine("acme/demo", "", state(9)))
    out = json.loads(run(tutor.repo_tree.coroutine("acme/demo", "", state(tutor.MAX_CODE_LOOKS))))
    assert "Answer now" in out["error"]


def test_the_tutor_run_allows_a_long_walk_through():
    from app.agents import tutor

    assert tutor.RECURSION_LIMIT >= 4 * (tutor.MAX_CODE_LOOKS + 5)
