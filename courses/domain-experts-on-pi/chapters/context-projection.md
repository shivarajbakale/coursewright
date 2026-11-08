# Context projection: what the model sees versus what is logged

The log holds everything: messages, system patches and more. You might think the model reads all of it. That cannot always be right. A tool may return 200 rows of data, and the model needs only the totals. A program may want to save a note for itself that the model should never read. Can the log keep an entry while the model sees something else, or nothing?

Think of a hospital file and the summary sheet a doctor reads on the ward. The file holds every test result, and nobody tears pages out of it. The sheet shows the doctor only what matters now. A nurse can staple a correction note over an old result on the sheet, and the original stays in the file. The comparison differs in one way. A paper sheet is made once. pi builds the model's view again for every request.

## The projection

pi rebuilds what the model sees from the session before each request. The code passes `messages: projection.messages` to the model. The **projection** is this rebuilt list of messages. It starts from the path through the session tree, and then two kinds of entry change it.

A **custom entry** is data that an extension saves in the session. It has the type `custom`. The model never sees it. It is state for the extension, not part of the conversation. A related type, `custom_message`, is different: the model does see it.

A **context edit** is a later entry that replaces what the model sees of an earlier entry. It has a `targetId`, which names the entry to change, and a `replacement`. If the replacement is `null`, the target is hidden from the model. The edit is appended like any entry. The old entry stays in the file. If several edits point at the same target, the latest one wins.

## A small case

Take an agent that answers questions about a shop database. It runs a query tool and gets 200 rows from an `orders` table. These steps follow one request:

1. pi saves the tool result entry with all 200 rows.
2. An extension saves a `custom` entry with the same rows, so a grader can check them later. The model will not see it.
3. A context edit targets the tool result and replaces it with one line: "200 orders, total 48,210".
4. pi builds the projection. The model sees the one line. The log still holds the 200 rows.

The numbers in the line are an example. The model reads less, and the record is whole.

```inkling
title "The log and the projection"
layout flow
log: db "Session log"
filter: diamond "In the projection?"
view: box "What the model sees" green
custom: box "custom entry: hidden"
edit: box "context edit: replaces an entry"
log -> filter : "every request"
filter -> view : "messages"
filter -> custom : "never shown"
edit -> filter : "swaps the content"
step 1: log "Everything is saved in the log"
step 2: filter "Each request is rebuilt from the log"
step 3: custom "A custom entry stays out of the view"
step 4: edit "A context edit changes what an entry shows"
step 5: view "The model sees only the projection"
circle filter
```

> **Key idea:** The model sees a projection of the log. Custom entries are hidden, and context edits change what it sees without changing the log.

A last detail: pi saves a message only when it is complete. The pieces of a reply that streams in are never written. So the log never holds half a message.

## How pi does it

Each request is rebuilt with `messages: projection.messages` (`packages/coding-agent/src/core/agent-session.ts:803-815`). The `custom` entry is extension state, outside the model's context (`packages/coding-agent/src/core/session-manager.ts:118-132`). The `custom_message` entry is in the context (`packages/coding-agent/src/core/session-manager.ts:147-165`).

The `context_edit` entry has `targetId` and `replacement | null` (`packages/coding-agent/src/core/session-manager.ts:174-180`). The latest edit per target wins (`packages/coding-agent/src/core/session-manager.ts:544-574`). Messages are saved at `message_end` only (`packages/coding-agent/src/core/agent-session.ts:1162-1184`).

## What you have now

You know that the model reads a projection of the log, built from the session tree path and the prompt patches. Custom entries and context edits let an expert keep a full record while it shows the model less. The open question is what happens when even the projection is too big for the context window.
