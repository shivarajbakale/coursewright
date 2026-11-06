"""Run an eval: `uv run python -m evals.run tutor|interviewer|builder|teaching [--limit N] [--folder PATH] [--estimate] [--no-reader]`.

Prints a cost estimate first, then refuses clearly if ANTHROPIC_API_KEY is not set. Results are written to
evals/results/<kind>-<timestamp>.json."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from evals import builder, interviewer, teaching, tutor
from evals.common import print_estimate, require_key_or_exit, save_results


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m evals.run", description=__doc__)
    ap.add_argument("kind", choices=["tutor", "interviewer", "builder", "teaching"])
    ap.add_argument("--limit", type=int, default=None, help="only the first N questions/topics")
    ap.add_argument("--folder", type=Path, default=None, help="builder: the course folder to grade")
    ap.add_argument("--no-reader", action="store_true", help="teaching: code metrics only, no model calls")
    ap.add_argument("--estimate", action="store_true", help="print the cost estimate and stop")
    args = ap.parse_args(argv)

    print(f"Eval: {args.kind}")
    if args.kind == "tutor":
        parts = tutor.estimate(args.limit)
    elif args.kind == "interviewer":
        parts = interviewer.estimate(args.limit)
    elif args.kind == "teaching":
        parts = [] if args.no_reader else teaching.estimate(args.folder or builder.default_folder())
    else:
        parts = builder.estimate(args.folder or builder.default_folder())
    print_estimate(parts)
    if args.estimate:
        return 0
    if parts:
        require_key_or_exit()

    if args.kind == "tutor":
        out = asyncio.run(tutor.run(args.limit))
    elif args.kind == "interviewer":
        out = asyncio.run(interviewer.run(args.limit))
    elif args.kind == "teaching":
        folder = args.folder or builder.default_folder()
        if folder is None or not (folder / "outline.json").exists():
            raise SystemExit("No built course folder found: pass --folder <path to a course folder with outline.json>.")
        out = asyncio.run(teaching.run(folder, with_reader=not args.no_reader, limit=args.limit))
    else:
        out = asyncio.run(builder.run(args.folder))
    path = save_results(args.kind, out)
    print("\nSummary:\n" + json.dumps(out["summary"], indent=2))
    print(f"Results: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
