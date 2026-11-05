"""Shared bits: key check, cost estimate, the LLM judge, result files."""

from __future__ import annotations

import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from app import config

JUDGE_MODEL = None  # the configured model (config.model()); set CW_JUDGE_MODEL to grade with another
# Claude Opus 5.5 list prices, USD per million tokens (first-party API). Estimates only.
PRICE_IN = 4.00
PRICE_OUT = 20.00
RESULTS_DIR = Path(__file__).parent / "results"

T = TypeVar("T", bound=BaseModel)


@dataclass
class Estimate:
    what: str
    calls: int
    input_tokens: int
    output_tokens: int

    @property
    def usd(self) -> float:
        return (self.input_tokens * PRICE_IN + self.output_tokens * PRICE_OUT) / 1_000_000


def print_estimate(parts: list[Estimate]) -> float:
    total = sum(p.usd for p in parts)
    print("Cost estimate (claude-opus-5-5 at $%.2f / $%.2f per MTok in/out; rough, before caching):" % (PRICE_IN, PRICE_OUT))
    for p in parts:
        print(f"  {p.what:<44} {p.calls:>4} calls  ~{p.input_tokens/1000:>7.0f}k in  ~{p.output_tokens/1000:>6.0f}k out  ~${p.usd:.2f}")
    print(f"  {'total':<44} {'':>10}  ~${total:.2f}")
    return total


def require_key_or_exit() -> None:
    sys.stdout.flush()
    if not config.anthropic_key():
        print(
            "\nRefusing to run: ANTHROPIC_API_KEY is not set. These evals call Claude (the agent under test and "
            "the judge), so they need a key and cost the amount above. Set it in the environment or agent/.env.",
            file=sys.stderr,
        )
        raise SystemExit(2)


async def judge(*, system: str, user: str, schema: type[T], effort: str = "high", max_tokens: int = 8000) -> tuple[T, dict]:
    """The grader, with structured output so every verdict has the same shape."""
    import os

    import anthropic

    from app.agents import llm

    judge_model = os.environ.get("CW_JUDGE_MODEL") or config.model()
    if not config.is_anthropic():
        return await llm._parse_with_tool(system=system, user=user, schema=schema, max_tokens=max_tokens)
    client = anthropic.AsyncAnthropic(api_key=config.anthropic_key())
    msg = await client.messages.parse(
        model=judge_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort},
        output_format=schema,
    )
    if msg.parsed_output is None:
        raise RuntimeError(f"judge returned no structured output (stop_reason={msg.stop_reason})")
    return msg.parsed_output, {"inputTokens": msg.usage.input_tokens, "outputTokens": msg.usage.output_tokens}


def save_results(kind: str, payload: dict) -> Path:
    RESULTS_DIR.mkdir(exist_ok=True)
    path = RESULTS_DIR / f"{kind}-{time.strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    return path


def actual_cost(usages: list[dict]) -> float:
    i = sum(u.get("inputTokens", 0) for u in usages)
    o = sum(u.get("outputTokens", 0) for u in usages)
    return (i * PRICE_IN + o * PRICE_OUT) / 1_000_000
