# Prompt patch: the system prompt kept as log messages

The system prompt tells the model its role and its rules. The harness also tells the model which tools it may call. Both can change during a session. A new skill file may appear, or a tool may be switched off.

Later you want to check what the model was told at turn 9. If the prompt lives only in a variable in memory, the file cannot answer. Where should the prompt live so the log can?

Think of a company rulebook with loose pages. You do not reprint the whole book for each change. You file a one-page notice: "Replace page 7 with this page. Remove page 12." A new employee who reads the book and then every notice in order learns the current rules. The log is like the book plus the notices. One difference: a pi notice replaces a whole named section, never a part of one.

## Messages with role system

pi writes the system prompt into the session as a message with the role `system`. The first such message holds every part of the prompt and every tool. When something changes later, pi writes a small new system message. It does not rewrite the old one.

A **section** is a named part of the system prompt, such as the preamble, the tools or the skills. A system message has these fields:

- `content`: the text of the message.
- `sections`: a map from a section name to its new text. A value of `null` removes that section.
- `toolsAdded`: the tools that now exist.
- `toolsRemoved`: the tools that no longer exist.

pi builds the prompt from these section names, in this order: `preamble`, `tools`, `rules`, `docs`, `addendum`, `project_context`, `skills` and `cwd`.

## A small trace

The first system message in a log has the sections `preamble`, `tools` and `cwd`, and a `toolsAdded` list. Then the user writes, and the assistant answers. Later the skills change, and the `write` tool is switched off. pi appends one more system message:

```json
{"sections":{"skills":"<skills>...</skills>"},"toolsRemoved":[{"name":"write"}]}
```

It carries only the skills section and the removal of `write`. The preamble, the cwd and the other tools are not repeated. To find the current prompt, replay the system messages in order. Start with the first message, then apply each patch. The last state is the prompt in force.

```inkling
title "A prompt and one patch"
layout timeline
- 1: System message: preamble, tools, cwd
- 2: User message
- 3: Assistant message
- 4: System patch: new skills, write removed
span 1..4 "replay in order to get the current prompt"
steps auto
```

> **Key idea:** pi stores the system prompt and tools as system messages. Later messages replace named sections, and replaying them in order gives the current prompt.

Some model services do not accept a system message in the middle of a conversation. For those, pi merges all system messages into one message at the start before it sends the request. The log keeps the patches. Only the request changes.

## Why experts care

An expert has a role and a small set of tools. The log now shows that the role and the tools were really in force at every point. If a tool was removed at turn 4, the log says so.

## How pi does it

The `SystemMessage` type has `content`, `sections?: Record<string, string | null>`, `toolsAdded?` and `toolsRemoved?` (`packages/ai/src/types.ts:561-577`). Its comment says "Replaying every system message in order yields the current prompt and tools" (`packages/ai/src/types.ts:556-559`). The section names are built in `packages/coding-agent/src/core/system-prompt.ts:128-192`. Example log lines are in `packages/coding-agent/docs/session-format.md:83-84`. The merge for models that cannot take middle system messages is in `packages/ai/src/utils/transcript.ts:115-120`.

## What you have now

You know that the prompt and tools live in the log as system messages, and that patches replace named sections. This sits on the session tree: system messages are entries on the path, so a branch keeps the prompt that was in force at its start. The open question is whether the model sees every entry in the log.
