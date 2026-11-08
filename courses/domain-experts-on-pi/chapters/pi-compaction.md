# Compaction: summarising old turns when the window fills

A long task adds tokens at every turn: tool results, model replies, your messages. The context window has a fixed size. When the conversation gets close to it, the next request will fail. You could delete old messages, but the model would lose the goal and the decisions made so far. What can pi do so the work goes on and the knowledge stays?

Think of a student who fills the last page of a notebook before an exam. The student writes a one-page summary of the older notes and keeps only the last few pages in full. The summary carries what matters, and the full pages stay on the desk. The comparison differs in one way. A student keeps the old notebook on the shelf and may reread it. pi's model never rereads the old entries. It sees only the summary.

## The trigger

pi has two settings for this. `reserveTokens` is 16384: room that pi keeps free for the next reply. `keepRecentTokens` is 20000: how much recent conversation pi keeps in full.

pi compacts when the tokens in the context pass the window minus the reserve. For DeepSeek V4.1 Flash, the window is 1,000,000 tokens. The limit is 1,000,000 - 16,384 = 983,616 tokens. Above 983,616 tokens, pi compacts. pi also compacts when a request fails with an overflow error. It then compacts once and retries the request once.

## What compaction does

These steps follow one compaction:

1. Pick a cut point that keeps about 20,000 recent tokens.
2. Ask the model for a summary. A **summary** is a short written account that replaces older messages in what the model sees.
3. Save the summary as a `compaction` entry. The entry has a field `firstKeptEntryId`, which names the first entry that stays in full.
4. Build the view from now on as the system checkpoint, then the summary, then the kept entries.

pi never cuts at a tool result, so a tool call and its result stay together. Nothing is deleted from the file. The old entries are still there. Only the view changes.

The summary has fixed sections: Goal, Constraints & Preferences, Progress, Key Decisions, Next Steps and Critical Context. When the window fills a second time, pi does not start again. It updates the previous summary with the new material.

```inkling
title "Before and after compaction"
layout compare
columns "Before", "After"
row "Old turns": "all messages in full", "one summary"
row "Recent turns": "in full", "about 20,000 tokens in full"
row "Start of the view": "system checkpoint", "system checkpoint, then the summary"
row "The file": "all entries", "all entries, plus a compaction entry"
step 1: old-turns "Old turns become one summary"
step 2: recent-turns "About 20,000 recent tokens stay in full"
step 3: start-of-the-view "The summary sits after the system checkpoint"
step 4: the-file "The file only grows"
```

> **Key idea:** When tokens pass the window minus a reserve, pi summarises older entries and keeps about 20,000 recent tokens. Nothing leaves the file.

## What an expert can do

An extension can cancel or replace compaction. It listens for the `session_before_compact` event. An expert can use this to tell the summariser what its domain must keep, for example the exact table names an analyst used.

## How pi does it

The defaults are in `packages/coding-agent/src/core/compaction/compaction.ts:126-130`. The trigger `contextTokens > contextWindow - reserveTokens` is at `packages/coding-agent/src/core/compaction/compaction.ts:267-270`. The retry after an overflow error is in `packages/coding-agent/src/core/agent-session.ts:3084-3127`.

The rule against cutting at a tool result is at `packages/coding-agent/src/core/compaction/compaction.ts:388-406`. The summary sections are at `packages/coding-agent/src/core/compaction/compaction.ts:507-538`, and the update of an older summary is at `packages/coding-agent/src/core/compaction/compaction.ts:540-579`. The view order is in `packages/coding-agent/src/core/session-manager.ts:461-464` and `packages/coding-agent/src/core/session-manager.ts:476-512`. The `session_before_compact` event is at `packages/coding-agent/src/core/agent-session.ts:3205-3225`.

## What you have now

You know why a full window is a problem, how pi decides to compact, and what the model sees afterwards. This joins the context window to the projection: a compaction entry changes what the model sees and leaves the log whole. You now have the parts of pi that hold, show and shrink a conversation.
