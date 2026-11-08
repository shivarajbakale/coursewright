# Session log: the record of everything the agent did

The harness runs the loop, holds the tools and writes the system prompt. It also keeps a record of the conversation. Ask where that record lives. If the program kept it only in memory, a crash, a closed window or a stopped process would lose every turn. A long task could not continue after a pause.

Think of a ship's logbook. The officer on watch writes one line at a time: the time, the position, what happened. Each new line goes at the bottom of the page. Nobody rewrites yesterday's line. A relief officer reads the book from the first page and knows the state of the ship.

The comparison holds for order: the newest fact is last, and reading from the top replays the voyage. It differs in one way: a person can skip a line, while the harness's file must keep a shape that its own reading code expects.

A session is one conversation between a user and the agent. The harness writes it as a text file with one JSON object per line. JSON writes an object as braces around names and values. A newline ends each object, and the next object starts on the next line. This format is called JSONL: JSON Lines.

Suppose the conversation has a header and one user message. The file has two lines, each one complete object:

```jsonl
{"type":"session","version":3,"id":"...","timestamp":"...","cwd":"/path/to/project"}
{"type":"message","id":"a1b2c3d4","parentId":"prev1234",...,"message":{"role":"user","content":"Hello"}}
```

The first line is a header. It says that this file is a session, gives the version of the format, a timestamp and the project folder. The second line is one entry, a message with the role `user` and the content `Hello`.

To read the file, the harness goes through it one line at a time. Each line becomes one object. The message objects, in file order, are the conversation. The harness sends them to the model in that order. A conversation that stopped after this message can start again with the same history.

Writing is an append. The harness adds one complete line for each new message or tool result:

1. Open the file at its end.
2. Write one line for the new entry.
3. Write a newline after it.

Old lines are never moved or rewritten. Because of this, a crash can lose the line being written and nothing earlier. The alternative, editing a line in the middle, would move all the text after it. That is slower and can leave a half-written file.

The log is also how you check an agent's work. A final reply can claim that a query ran. The log shows the tool call, its arguments and the tool result. If the agent says it read a table, the log shows whether it did.

```inkling
title "One session file, line by line"
layout timeline
- 1: Header
- 2: Your message
- 3: Tool call
- 4: Tool result
- 5: Final answer
span 2..4 "one turn"
steps auto
```

These lines have a name. A **JSONL** file is a text file with one JSON object on each line, and new lines are added only at the end.

> **Key idea:** The harness adds every message and tool result to the end of a file, so the conversation can be read back and resumed.

## How pi does it

pi saves sessions as JSONL files under `~/.pi/agent/sessions/`, in a folder named after the project directory (packages/coding-agent/src/core/session-manager.ts:588-595). The first line is a header: `{"type":"session","version":3,"id":"...","timestamp":"...","cwd":"/path/to/project"}` (packages/coding-agent/docs/session-format.md:69). The version number is set in packages/coding-agent/src/core/session-manager.ts:41. A later line holds a message such as the `Hello` entry above (packages/coding-agent/docs/session-format.md:90). Run `pi -c` to continue the most recent session.

## What you have now

You know how the harness keeps its record, and why it writes at the end instead of editing. That record answers what the agent did and carries the conversation across a stop.
