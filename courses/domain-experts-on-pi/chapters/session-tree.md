# Session tree: entries with parents and a moving leaf

The session log is a file where each line is added at the end. That makes it look like a straight list. But suppose you read the answer to your third question and see that your second question was the mistake. You want to go back to it and ask again, without losing the first try. How can a file that only grows hold two different futures?

Think of a family tree drawn on paper. Each person is a name with a line up to one parent. Nobody erases a person to add a sibling. You add a new name and draw its line to the same parent. The paper holds both children, and you can follow either line back to the oldest ancestor.

A session file works like this, with one difference. A family tree has many people at once. A session has one current position, and the model reads only the path that leads to it.

## Parents and the leaf

Every line in a pi session file is an entry. Each entry has four basic fields: `type`, `id`, `parentId` and `timestamp`. The `id` is 8 hexadecimal characters. The `parentId` names the entry that came before this one on its path.

Because every entry names its parent, the file holds a **tree**, not a list. The harness also keeps one pointer, called the **leaf**. The leaf is the newest entry on the current path.

When you add a message, two things happen:

1. The new entry gets the leaf as its parent.
2. The leaf moves to the new entry.

## Going back

Suppose you send three messages. Call the entries a, b and c. Entry a has no parent, b has parent a, and c has parent b. The leaf is c.

Now you want to go back to b and ask something else. The harness does not delete c. It only moves the leaf to b. The line of code is `this.leafId = branchFromId`. Nothing in the file changes.

You send a new message. It becomes entry d, and its parent is b. The leaf moves to d. A second path now starts from b. This second path is a **branch**: a path that starts from an earlier entry.

The file holds four entries: a, b, c and d. The model does not see all four. To build what the model sees, the harness starts at the leaf and walks back through the parents to the root.

From d it visits d, b and a. Then it reverses the list. The model sees a, b, d. Entry c is still in the file, but it is not on the path.

```inkling
title "One file, two branches"
layout flow
a: box "a"
b: box "b"
c: box "c"
d: box "d (leaf)" green
a -> b : "parent"
b -> c : "first try"
b -> d : "second try"
step 1: a, b "a and b are the shared start"
step 2: c "c is the first branch; it stays in the file"
step 3: d "d is the new leaf; the model sees a, b, d"
circle d
```

When pi loads a saved session, it sets the leaf to the last entry in the file. So a resumed session continues from the most recent message.

> **Key idea:** Each entry names its parent. Going back only moves the leaf, and the model sees the path from the root to the leaf.

## Why this matters for experts

An expert often needs to retry from a clean point, or an evaluation needs to run the same start many times. A tree keeps every try in one file, and no try overwrites another.

## How pi does it

Every entry has `{type, id, parentId, timestamp}` (`packages/coding-agent/src/core/session-manager.ts:57-62`). Ids are 8 hex characters (`packages/coding-agent/src/core/session-manager.ts:277-284`). Adding a message makes it a child of the leaf and moves the leaf to it (`packages/coding-agent/src/core/session-manager.ts:1215-1225`).

`branch(id)` only moves the leaf: `this.leafId = branchFromId` (`packages/coding-agent/src/core/session-manager.ts:1590-1595`). To build what the model sees, pi walks from the leaf back to the root (`packages/coding-agent/src/core/session-manager.ts:476-512`). On load, the leaf is the last entry in the file (`packages/coding-agent/src/core/session-manager.ts:1109-1113`). The file format is version 3, and pi upgrades versions 1 and 2 automatically (`packages/coding-agent/src/core/session-manager.ts:41`).

## What you have now

You know that a session file is a tree with a leaf, and that going back moves the leaf and starts a branch. You also know that the model reads one path of it. This builds on the session log and the pi loop, which fill the file one entry at a time. The open question is what the entry at the root of that path holds.
