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

import asyncio
import logging
import os

from typing import Literal, TypeVar

from pydantic import BaseModel

from app import config

Effort = Literal["low", "medium", "high", "xhigh", "max"]
T = TypeVar("T", bound=BaseModel)

log = logging.getLogger(__name__)


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


def _inline_refs(schema: dict) -> dict:
    """The Pydantic JSON schema with every `$ref` replaced by its definition. Some providers handle a
    flat schema far better than `$defs` + `$ref`."""
    defs = schema.get("$defs", {})

    def walk(node):
        if isinstance(node, dict):
            if "$ref" in node:
                return walk(defs[node["$ref"].split("/")[-1]])
            return {k: walk(v) for k, v in node.items() if k != "$defs"}
        if isinstance(node, list):
            return [walk(v) for v in node]
        return node

    return walk(schema)


def _repair(value, schema: dict):
    """Coerce near-misses some models produce into the schema's shape before validation:
    "true"/"false"/"3" strings for booleans and integers, arrays wrapped as {"item": [...]}, and a
    nested object's fields hoisted to its parent. Anything else is left for Pydantic to judge."""
    if "anyOf" in schema:
        non_null = [s for s in schema["anyOf"] if s.get("type") != "null"]
        if value is None or not non_null:
            return value
        schema = non_null[0]
    kind = schema.get("type")
    if kind == "boolean" and isinstance(value, str) and value.lower() in ("true", "false"):
        return value.lower() == "true"
    if kind == "integer" and isinstance(value, str) and value.strip().lstrip("-").isdigit():
        return int(value)
    if kind == "array":
        if isinstance(value, dict) and len(value) == 1 and isinstance(next(iter(value.values())), list):
            value = next(iter(value.values()))
        if isinstance(value, list):
            return [_repair(v, schema.get("items", {})) for v in value]
        return value
    if kind == "object" and isinstance(value, dict):
        props = schema.get("properties", {})
        value = dict(value)
        for name, sub in props.items():
            sub_obj = sub
            if "anyOf" in sub:
                sub_obj = next((s for s in sub["anyOf"] if s.get("type") == "object"), sub)
            if sub_obj.get("type") == "object" and isinstance(value.get(name), dict):
                child_props = sub_obj.get("properties", {})
                for key in list(value):
                    if key in child_props and key not in props and key not in value[name]:
                        value[name][key] = value.pop(key)  # hoisted field: put it back in its object
        return {k: (_repair(v, props[k]) if k in props else v) for k, v in value.items()}
    return value


RATE_WAITS = (20, 40, 80, 160, 300)  # seconds; about ten minutes in all before a rate limit fails a call
_gates: dict[int, asyncio.Semaphore] = {}


def _gate() -> asyncio.Semaphore:
    """One cap on model calls in flight across every job in this process (CW_MAX_CALLS, default 8), so two
    builds at once don't double the rate a provider plan allows."""
    loop = id(asyncio.get_running_loop())
    if loop not in _gates:
        _gates[loop] = asyncio.Semaphore(int(os.environ.get("CW_MAX_CALLS", "8")))
    return _gates[loop]


async def _create(method, **kwargs):
    """A model call that waits out a rate limit or an overloaded provider instead of failing the build."""
    import anthropic

    for i, wait in enumerate((*RATE_WAITS, None)):
        try:
            async with _gate():
                return await method(**kwargs)
        except (anthropic.RateLimitError, anthropic.InternalServerError) as e:
            status = getattr(e, "status_code", 0)
            if wait is None or (isinstance(e, anthropic.InternalServerError) and status not in (500, 502, 503, 529)):
                raise
            log.warning("model call hit %s (try %d); waiting %ss", status, i + 1, wait)
            await asyncio.sleep(wait)


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
        "input_schema": _inline_refs(schema.model_json_schema()),
    }
    messages: list[dict] = [{"role": "user", "content": user}]
    usage = {"inputTokens": 0, "outputTokens": 0}
    empty = 0
    invalid = 0
    while True:
        msg = await _create(
            client.messages.create,
            model=config.model(),
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            tools=[tool],
            tool_choice={"type": "tool", "name": "respond"},
        )
        if msg.usage:
            usage["inputTokens"] += msg.usage.input_tokens or 0
            usage["outputTokens"] += msg.usage.output_tokens or 0
        # Some providers now and then return a reply with no content at all: ask again, twice at most.
        call = next((b for b in (msg.content or []) if getattr(b, "type", "") == "tool_use"), None)
        if call is None:
            empty += 1
            if empty > 2:
                raise RuntimeError(f"model returned no structured output (stop_reason={msg.stop_reason})")
            continue
        try:
            return schema.model_validate(_repair(call.input, tool["input_schema"])), usage
        except ValidationError as e:
            invalid += 1
            log.info("%s did not validate (%d): %s", schema.__name__, invalid, str(e)[:600])
            if invalid > 1:
                raise RuntimeError("model's structured output did not validate after a retry") from e
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
    msg = await _create(
        client.messages.parse,
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
    msg = await _create(
        client.messages.create,
        model=config.model(),
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        **extra,
    )
    return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
