"""Read a public GitHub codebase for the tutor: the file tree, a file's lines, an outline of its symbols
(tree-sitter), a text search and a definition lookup. No clone and no write access.

- Repository metadata and the recursive tree come from the REST API (two calls per repository, cached for
  ten minutes): without GITHUB_TOKEN GitHub allows 60 API calls an hour, so they are kept few.
- File contents come from raw.githubusercontent.com, which is not counted against that limit.
- With GITHUB_TOKEN set, search uses GitHub code search first; without it, search reads the likeliest files
  (by path, optionally inside one folder) and greps them.

Every public function returns a dict ready to json.dumps, or raises CodebaseError with a message written for
the learner.
"""

from __future__ import annotations

import asyncio
import re
import time
from collections import OrderedDict
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from app import config

API = "https://api.github.com"
RAW = "https://raw.githubusercontent.com"
TTL_SECONDS = 600
MAX_FILE_BYTES = 400_000
MAX_READ_LINES = 400
MAX_TREE_LINES = 250
SEARCH_FILES = 40
MAX_HITS = 30
CONCURRENCY = 8

SKIP = re.compile(r"(^|/)(node_modules|vendor|dist|build|target|\.git|__pycache__|\.venv|coverage)/|\.min\.|(^|/)[^/]*lock(\.json|\.yaml)?$")
TEXT_EXT = re.compile(
    r"\.(py|pyi|js|jsx|mjs|cjs|ts|tsx|mts|go|rs|java|kt|c|cc|cpp|h|hpp|rb|ex|exs|scala|cs|swift|zig|php|lua|sh|"
    r"md|mdx|txt|toml|yaml|yml|json|sql|proto|graphql|css|html)$|(^|/)(Makefile|Dockerfile|README[^/]*)$",
    re.I,
)
_NAME = r"[A-Za-z0-9_.-]+"
_REPO = re.compile(
    rf"^(?:https?://)?(?:www\.)?(?:github\.com/)?(?P<owner>{_NAME})/(?P<repo>{_NAME}?)(?:\.git)?"
    rf"(?:/(?:tree|blob)/(?P<ref>[^/\s]+)(?:/(?P<path>[^\s?#]*))?)?/?(?:[?#].*)?$"
)

# Tests swap this for an httpx.MockTransport.
transport: httpx.AsyncBaseTransport | None = None


class CodebaseError(Exception):
    pass


@dataclass(frozen=True)
class RepoRef:
    owner: str
    name: str
    ref: str | None = None
    path: str = ""

    @property
    def full(self) -> str:
        return f"{self.owner}/{self.name}"


def parse_repo(text: str) -> RepoRef:
    """'owner/repo', a github.com URL, or a /tree/<ref>/<path> or /blob/<ref>/<path> URL."""
    m = _REPO.match(text.strip())
    if not m or m["owner"] in ("tree", "blob"):
        raise CodebaseError(f"'{text}' is not a GitHub repository. Use owner/repo or a github.com link.")
    return RepoRef(m["owner"], m["repo"], m["ref"], (m["path"] or "").strip("/"))


# ---- fetching, with small caches ---------------------------------------------------------------------------

_trees: dict[tuple[str, str | None], tuple[float, dict]] = {}
_files: OrderedDict[tuple[str, str, str], str] = OrderedDict()


def _client() -> httpx.AsyncClient:
    headers = {"User-Agent": "Coursewright/0.1", "Accept": "application/vnd.github+json"}
    return httpx.AsyncClient(headers=headers, timeout=30, follow_redirects=True, transport=transport)


def _api_headers() -> dict[str, str]:
    token = config.github_token()
    return {"Authorization": f"Bearer {token}"} if token else {}


def _api_problem(r: httpx.Response, what: str) -> CodebaseError:
    if r.status_code in (403, 429) and r.headers.get("x-ratelimit-remaining") == "0":
        return CodebaseError(
            "GitHub's rate limit is used up (60 requests an hour without a token). Try again later, "
            "or set GITHUB_TOKEN on the server."
        )
    if r.status_code == 404:
        return CodebaseError(f"{what} was not found. Is the repository public and the name right?")
    return CodebaseError(f"GitHub answered {r.status_code} for {what}.")


async def repo_index(repo: RepoRef) -> dict:
    """{"repo", "ref", "files": [paths], "dirs": [paths], "truncated"} for the repository at its ref."""
    key = (repo.full.lower(), repo.ref)
    hit = _trees.get(key)
    if hit and time.monotonic() - hit[0] < TTL_SECONDS:
        return hit[1]
    async with _client() as gh:
        ref = repo.ref
        if not ref:
            meta = await gh.get(f"{API}/repos/{repo.full}", headers=_api_headers())
            if meta.status_code != 200:
                raise _api_problem(meta, repo.full)
            ref = meta.json().get("default_branch") or "main"
        tree = await gh.get(f"{API}/repos/{repo.full}/git/trees/{quote(ref, safe='')}", params={"recursive": "1"},
                            headers=_api_headers())
        if tree.status_code != 200:
            raise _api_problem(tree, f"{repo.full} at {ref}")
    body = tree.json()
    entries = body.get("tree", [])
    index = {
        "repo": repo.full,
        "ref": ref,
        "files": [e["path"] for e in entries if e.get("type") == "blob"],
        "sizes": {e["path"]: e.get("size", 0) for e in entries if e.get("type") == "blob"},
        "dirs": [e["path"] for e in entries if e.get("type") == "tree"],
        "truncated": bool(body.get("truncated")),
    }
    _trees[key] = (time.monotonic(), index)
    return index


async def file_text(repo: str, ref: str, path: str, size: int = 0) -> str:
    key = (repo.lower(), ref, path)
    if key in _files:
        _files.move_to_end(key)
        return _files[key]
    if size > MAX_FILE_BYTES:
        raise CodebaseError(f"{path} is {size // 1000} KB, too big to read here.")
    async with _client() as gh:
        r = await gh.get(f"{RAW}/{repo}/{quote(ref, safe='')}/{quote(path)}")
    if r.status_code != 200:
        raise CodebaseError(f"Could not read {path} ({r.status_code}).")
    if b"\x00" in r.content[:2000]:
        raise CodebaseError(f"{path} is a binary file.")
    text = r.content[:MAX_FILE_BYTES].decode("utf-8", errors="replace")
    _files[key] = text
    if len(_files) > 300:
        _files.popitem(last=False)
    return text


def _resolve_path(index: dict, path: str) -> str:
    p = path.strip().strip("/")
    if p in index["sizes"]:
        return p
    ends = [f for f in index["files"] if f.endswith("/" + p) or f == p]
    if len(ends) == 1:
        return ends[0]
    if ends:
        raise CodebaseError(f"'{path}' matches several files: {', '.join(ends[:8])}. Give the full path.")
    raise CodebaseError(f"There is no file '{path}' in {index['repo']} at {index['ref']}.")


def blob_url(index: dict, path: str, start: int = 0, end: int = 0) -> str:
    url = f"https://github.com/{index['repo']}/blob/{index['ref']}/{path}"
    return url + (f"#L{start}-L{end}" if start and end and end != start else f"#L{start}" if start else "")


# ---- the five reads ----------------------------------------------------------------------------------------


async def tree(repo_text: str, path: str = "") -> dict:
    """The folders and files under `path`, one level of files and the folders below with their file counts."""
    repo = parse_repo(repo_text)
    index = await repo_index(repo)
    base = (path or repo.path).strip("/")
    if base and base not in index["dirs"]:
        raise CodebaseError(f"There is no folder '{base}' in {index['repo']}.")
    prefix = base + "/" if base else ""
    lines: list[str] = []
    counts: dict[str, int] = {}
    for f in index["files"]:
        if not f.startswith(prefix):
            continue
        rest = f[len(prefix):]
        if "/" in rest:
            top = rest.split("/", 1)[0]
            counts[top] = counts.get(top, 0) + 1
        else:
            lines.append(rest)
    out = [f"{d}/ ({n} files)" for d, n in sorted(counts.items())] + sorted(lines)
    shown = out[:MAX_TREE_LINES]
    return {
        "repo": index["repo"], "ref": index["ref"], "path": base, "entries": shown,
        "more": len(out) - len(shown), "totalFiles": len(index["files"]), "truncated": index["truncated"],
    }


async def read_file(repo_text: str, path: str, start_line: int = 1, end_line: int = 0) -> dict:
    """Lines start_line..end_line of a file, numbered; at most MAX_READ_LINES at a time."""
    repo = parse_repo(repo_text)
    index = await repo_index(repo)
    p = _resolve_path(index, path or repo.path)
    text = await file_text(index["repo"], index["ref"], p, index["sizes"].get(p, 0))
    all_lines = text.splitlines()
    start = max(1, int(start_line or 1))
    end = int(end_line or 0) or start + MAX_READ_LINES - 1
    end = min(end, start + MAX_READ_LINES - 1, len(all_lines))
    numbered = "\n".join(f"{i}\t{all_lines[i - 1]}" for i in range(start, end + 1))
    return {
        "repo": index["repo"], "ref": index["ref"], "path": p, "startLine": start, "endLine": end,
        "totalLines": len(all_lines), "url": blob_url(index, p, start, end), "text": numbered,
    }


async def outline(repo_text: str, path: str) -> dict:
    """The file's definitions (classes, functions, methods, types) with their lines, by tree-sitter."""
    from app import code_outline

    repo = parse_repo(repo_text)
    index = await repo_index(repo)
    p = _resolve_path(index, path or repo.path)
    if not code_outline.language_for(p):
        raise CodebaseError(f"No outline for {p}: outlines cover {', '.join(code_outline.SUPPORTED)}. Read it instead.")
    text = await file_text(index["repo"], index["ref"], p, index["sizes"].get(p, 0))
    symbols = code_outline.outline(p, text)
    return {
        "repo": index["repo"], "ref": index["ref"], "path": p, "url": blob_url(index, p),
        "totalLines": len(text.splitlines()), "symbols": symbols[:300],
    }


def _words(query: str) -> list[str]:
    parts = re.findall(r"[A-Za-z0-9]+", re.sub(r"([a-z])([A-Z])", r"\1 \2", query))
    return [w.lower() for w in parts if len(w) >= 3]


def _candidates(index: dict, query: str, folder: str, *, code_only: bool) -> list[str]:
    from app import code_outline

    prefix = folder.strip("/") + "/" if folder.strip("/") else ""
    words = _words(query)
    files = [
        f for f in index["files"]
        if f.startswith(prefix) and not SKIP.search(f) and index["sizes"].get(f, 0) <= MAX_FILE_BYTES
        and (code_outline.language_for(f) if code_only else TEXT_EXT.search(f))
    ]

    def rank(f: str) -> tuple:
        low = f.lower()
        score = -3 * sum(w in low for w in words)
        if "test" in low or "spec" in low:
            score += 1
        return (score, f.count("/"), len(f))

    return sorted(files, key=rank)[:SEARCH_FILES]


async def _read_many(index: dict, paths: list[str]) -> dict[str, str]:
    gate = asyncio.Semaphore(CONCURRENCY)

    async def one(p: str) -> tuple[str, str | None]:
        async with gate:
            try:
                return p, await file_text(index["repo"], index["ref"], p, index["sizes"].get(p, 0))
            except CodebaseError:
                return p, None

    return {p: t for p, t in await asyncio.gather(*(one(p) for p in paths)) if t is not None}


async def _code_search(index: dict, query: str, folder: str) -> list[str]:
    """Paths from GitHub code search (needs a token); [] when it is not available."""
    if not config.github_token():
        return []
    q = f"{query} repo:{index['repo']}" + (f" path:{folder.strip('/')}" if folder.strip("/") else "")
    async with _client() as gh:
        r = await gh.get(f"{API}/search/code", params={"q": q, "per_page": 20}, headers=_api_headers())
    if r.status_code != 200:
        return []
    return [i["path"] for i in r.json().get("items", []) if i.get("path") in index["sizes"]]


async def search(repo_text: str, query: str, path: str = "") -> dict:
    """Lines that contain the query (case-insensitive; a plain string, not a pattern)."""
    repo = parse_repo(repo_text)
    index = await repo_index(repo)
    folder = path or repo.path
    q = query.strip()
    if not q:
        raise CodebaseError("Give search some text to look for.")
    found = await _code_search(index, q, folder)
    paths = list(dict.fromkeys(found + _candidates(index, q, folder, code_only=False)))[: SEARCH_FILES + len(found)]
    texts = await _read_many(index, paths)
    needle = q.lower()
    hits = []
    for p in paths:
        for i, line in enumerate((texts.get(p) or "").splitlines(), 1):
            if needle in line.lower():
                hits.append({"path": p, "line": i, "text": line.strip()[:200], "url": blob_url(index, p, i)})
                if len(hits) >= MAX_HITS:
                    break
        if len(hits) >= MAX_HITS:
            break
    in_scope = sum(1 for f in index["files"] if f.startswith(folder.strip("/")))
    return {
        "repo": index["repo"], "ref": index["ref"], "query": q, "path": folder.strip("/"), "hits": hits,
        "searchedFiles": len(texts), "filesInScope": in_scope, "codeSearch": bool(found),
        "note": "" if len(texts) >= in_scope else
        "Only the likeliest files were searched. Narrow the search with a folder path to search more of it.",
    }


async def find_definition(repo_text: str, name: str, path: str = "") -> dict:
    """Where a class, function, method or type called `name` is defined, by tree-sitter over likely files."""
    from app import code_outline

    repo = parse_repo(repo_text)
    index = await repo_index(repo)
    folder = path or repo.path
    want = name.strip().split(".")[-1].split("::")[-1]
    if not want:
        raise CodebaseError("Give the name to look for.")
    found = [p for p in await _code_search(index, want, folder) if code_outline.language_for(p)]
    paths = list(dict.fromkeys(found + _candidates(index, want, folder, code_only=True)))[: SEARCH_FILES + len(found)]
    texts = await _read_many(index, paths)
    defs = []
    for p in paths:
        if p not in texts or want not in texts[p]:
            continue
        for s in code_outline.outline(p, texts[p]):
            if s["name"] == want or s["name"].endswith("." + want):
                defs.append({**s, "path": p, "url": blob_url(index, p, s["line"], s["endLine"])})
    return {
        "repo": index["repo"], "ref": index["ref"], "name": want, "definitions": defs[:20],
        "searchedFiles": len(texts),
        "note": "" if defs else "Not found in the likeliest files. Try search, or narrow with a folder path.",
    }
