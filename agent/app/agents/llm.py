"""Model factories.

- `chat_model(effort)`: a LangChain `ChatAnthropic` for deepagents graphs. langchain-anthropic 1.7 accepts
  `effort=` (alias of `reasoning_effort`) and sends it as `output_config.effort`. We never set `thinking`
  (on Opus 5.5 thinking is always on; `budget_tokens` is a 400) and never force `tool_choice` (a 400).
- `parse(...)`: one-off structured calls with the official `anthropic` SDK, `messages.parse` with
  `output_format=<pydantic model>` and `output_config.effort`.
"""

from __future__ import annotations

from typing import Literal, TypeVar

from pydantic import BaseModel

from app import config

Effort = Literal["low", "medium", "high", "xhigh", "max"]
T = TypeVar("T", bound=BaseModel)


class MissingKey(RuntimeError):
    def __init__(self) -> None:
        super().__init__("ANTHROPIC_API_KEY is not set")


def require_key() -> str:
    key = config.anthropic_key()
    if not key:
        raise MissingKey()
    return key


def chat_model(effort: Effort = "medium", max_tokens: int = 16000):
    from langchain_anthropic import ChatAnthropic

    # A placeholder key lets graphs be built at import time without a key; any call then fails with 401,
    # and every entry point checks `require_key()` first so callers see a clean error instead.
    return ChatAnthropic(
        model=config.MODEL,
        effort=effort,
        max_tokens=max_tokens,
        api_key=config.anthropic_key() or "missing-anthropic-key",
        max_retries=3,
    )


async def parse(
    *,
    system: str,
    user: str,
    schema: type[T],
    effort: Effort = "low",
    max_tokens: int = 4000,
) -> tuple[T, dict]:
    """Structured output via the anthropic SDK. Returns (parsed, usage)."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=require_key())
    msg = await client.messages.parse(
        model=config.MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort},
        output_format=schema,
    )
    parsed = msg.parsed_output
    if parsed is None:
        raise RuntimeError(f"model returned no structured output (stop_reason={msg.stop_reason})")
    usage = {"inputTokens": msg.usage.input_tokens, "outputTokens": msg.usage.output_tokens}
    return parsed, usage


async def text(*, system: str, user: str, effort: Effort = "low", max_tokens: int = 1000) -> str:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=require_key())
    msg = await client.messages.create(
        model=config.MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort},
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
