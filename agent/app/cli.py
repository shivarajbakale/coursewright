"""Write a course with a coding agent: check a course folder, import it, print the file schemas.

    uv run python -m app.cli check  <folder> [--strict] [--json] [--no-flow]
    uv run python -m app.cli import <folder> [--replace] [--strict] [--server URL]
    uv run python -m app.cli schema

`check` exits 1 when the folder has errors (or, with --strict, warnings). `import` checks first, then writes
the course into the local database (CW_DB_PATH, default agent/data/coursewright.db) or, with --server, sends
it to a running Coursewright (POST /api/courses/import; CW_SHARED_SECRET is sent as x-cw-secret if set).
The guide is docs/authoring-courses.md.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from app import authoring


def _print_report(report: authoring.Report, as_json: bool) -> None:
    if as_json:
        print(json.dumps(report.as_dict(), indent=2))
        return
    for i in report.issues:
        print(i)
    head = f'"{report.title}": {report.modules} modules, {report.lessons} lessons' if report.title else "course"
    print(f"{head} — {len(report.errors)} errors, {len(report.warnings)} warnings")


def cmd_check(args) -> int:
    report = authoring.check_folder(Path(args.folder), flow=not args.no_flow)
    _print_report(report, args.json)
    return 0 if report.ok(args.strict) else 1


def cmd_import(args) -> int:
    result = asyncio.run(
        authoring.import_course(Path(args.folder), replace=args.replace, strict=args.strict, server=args.server)
    )
    issues = result["report"]["issues"]
    for i in issues:
        print(f"{i['path']}: {i['level']}: {i['message']}")
    print(result["message"] + (f": {result['path']}" if result["ok"] else ""), file=sys.stdout if result["ok"] else sys.stderr)
    return 0 if result["ok"] else 1


def cmd_schema(_args) -> int:
    print(json.dumps(authoring.schemas(), indent=2))
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="report every problem in a course folder")
    c.add_argument("folder")
    c.add_argument("--strict", action="store_true", help="fail on warnings too")
    c.add_argument("--json", action="store_true", help="machine-readable report")
    c.add_argument("--no-flow", action="store_true", help="don't compile Flowmovie diagrams")
    c.set_defaults(fn=cmd_check)
    i = sub.add_parser("import", help="check, then save the course so it shows in the Library")
    i.add_argument("folder")
    i.add_argument("--replace", action="store_true", help="update a course imported before (drops its progress)")
    i.add_argument("--strict", action="store_true", help="refuse on warnings too")
    i.add_argument("--server", help="a running Coursewright's agent URL, e.g. http://localhost:8000")
    i.set_defaults(fn=cmd_import)
    s = sub.add_parser("schema", help="JSON Schemas of outline.json, chapters/<key>.json, projects/<key>.json")
    s.set_defaults(fn=cmd_schema)
    args = ap.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    raise SystemExit(main())
