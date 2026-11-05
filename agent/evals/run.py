"""Run an eval: `uv run python -m evals.run tutor|interviewer|builder [--limit N] [--folder PATH] [--estimate]`.

Prints a cost estimate first, then refuses clearly if ANTHROPIC_API_KEY is not set. Results are written to
evals/results/<kind>-<timestamp>.json."""

from __future__ import annotations

import argparse
import asyncio
import json
from pathlib import Path

from evals import builder, interviewer, tutor
from evals.common import print_estimate, require_key_or_exit, save_results


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="python -m evals.run", description=__doc__)
    ap.add_argument("kind", choices=["tutor", "interviewer", "builder"])
    ap.add_argument("--limit", type=int, default=None, help="only the first N questions/topics")
    ap.add_argument("--folder", type=Path, default=None, help="builder: the course folder to grade")
    ap.add_argument("--estimate", action="store_true", help="print the cost estimate and stop")
    args = ap.parse_args(argv)

    print(f"Eval: {args.kind}")
    if args.kind == "tutor":
        parts = tutor.estimate(args.limit)
    elif args.kind == "interviewer":
        parts = interviewer.estimate(args.limit)
    else:
        parts = builder.estimate(args.folder or builder.default_folder())
    print_estimate(parts)
    if args.estimate:
        return 0
    require_key_or_exit()

    if args.kind == "tutor":
        out = asyncio.run(tutor.run(args.limit))
    elif args.kind == "interviewer":
        out = asyncio.run(interviewer.run(args.limit))
    else:
        out = asyncio.run(builder.run(args.folder))
    path = save_results(args.kind, out)
    print("\nSummary:\n" + json.dumps(out["summary"], indent=2))
    print(f"Results: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
