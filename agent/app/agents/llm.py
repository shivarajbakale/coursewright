"""Model factories.

- `chat_model(effort)`: a LangChain `ChatAnthropic` for deepagents graphs. langchain-anthropic 1.7 accepts
  `effort=` (alias of `reasoning_effort`) and sends it as `output_config.effort`. We never set `thinking`
  (on Opus 5.5 thinking is always on; `budget_tokens` is a 400) and never force `tool_choice` (a 400).
- `parse(...)`: one-off structured calls with the official `anthropic` SDK, `messages.parse` with
  `output_format=<pydantic model>` and `output_config.effort`.

Other Anthropic-compatible providers (MiniMax via ANTHROPIC_BASE_URL + CW_MODEL) get the same calls minus
what they don't support: no `effort`, and structured output through one forced tool call whose input
schema is the Pydantic model's JSON schema, validated here.
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
    kwargs: dict = {}
    if config.is_anthropic():
        kwargs["effort"] = effort
    if config.anthropic_base_url():
        kwargs["base_url"] = config.anthropic_base_url()
    return ChatAnthropic(
        model=config.model(),
        max_tokens=max_tokens,
        api_key=config.anthropic_key() or "missing-anthropic-key",
        max_retries=3,
        **kwargs,
    )


def _client():
    import anthropic

    return anthropic.AsyncAnthropic(api_key=require_key(), base_url=config.anthropic_base_url())


async def _parse_with_tool(*, system: str, user: str, schema: type[T], max_tokens: int) -> tuple[T, dict]:
    """Structured output for providers without `output_format`: one forced tool call, validated."""
    from pydantic import ValidationError

    client = _client()
    tool = {
        "name": "respond",
        "description": "Return the answer in exactly this structure.",
        "input_schema": schema.model_json_schema(),
    }
    messages: list[dict] = [{"role": "user", "content": user}]
    usage = {"inputTokens": 0, "outputTokens": 0}
    for _ in range(2):
        msg = await client.messages.create(
            model=config.model(),
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            tools=[tool],
            tool_choice={"type": "tool", "name": "respond"},
        )
        usage["inputTokens"] += msg.usage.input_tokens
        usage["outputTokens"] += msg.usage.output_tokens
        call = next((b for b in msg.content if getattr(b, "type", "") == "tool_use"), None)
        if call is None:
            raise RuntimeError(f"model returned no structured output (stop_reason={msg.stop_reason})")
        try:
            return schema.model_validate(call.input), usage
        except ValidationError as e:
            # One retry, telling the model what was wrong.
            messages += [
                {"role": "assistant", "content": [call.model_dump()]},
                {
                    "role": "user",
                    "content": [
                        {"type": "tool_result", "tool_use_id": call.id, "is_error": True, "content": str(e)[:2000]}
                    ],
                },
            ]
    raise RuntimeError("model's structured output did not validate after a retry")


async def parse(
    *,
    system: str,
    user: str,
    schema: type[T],
    effort: Effort = "low",
    max_tokens: int = 4000,
) -> tuple[T, dict]:
    """Structured output via the anthropic SDK. Returns (parsed, usage)."""
    if not config.is_anthropic():
        return await _parse_with_tool(system=system, user=user, schema=schema, max_tokens=max_tokens)
    client = _client()
    msg = await client.messages.parse(
        model=config.model(),
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
    client = _client()
    extra = {"output_config": {"effort": effort}} if config.is_anthropic() else {}
    msg = await client.messages.create(
        model=config.model(),
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        **extra,
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
