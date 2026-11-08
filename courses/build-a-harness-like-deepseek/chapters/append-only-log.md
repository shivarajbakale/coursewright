# Append-only log: a record you add to and never change

The first agent keeps the chat in one `messages` array and changes it as it works. Suppose the agent deletes a file it should have left alone. Which request made the model ask for that, and what did that request contain? The array shows only how the chat looks now. When the program stops, even that is gone. How can the program keep a record that still answers "what happened" a week later?

## A bank statement

Think of a bank statement. Each line is one thing that happened: a deposit, a payment, a fee. The bank adds new lines at the bottom and never edits an old one. If a payment was wrong, the bank does not erase it. It adds a new line, a refund, below it.

Your balance is not stored anywhere on its own. You get it by adding up the lines from the top.

An agent can keep its history the same way. Each line is one fact: the user asked this, the model replied that, a tool returned this result. The statement and the agent's record differ in one way. A bank prints a statement once a month for a person to read. The agent reads its record before every model request, to know what to send.

```inkling
title "A record you only add to"
steps auto
layout timeline
- 0: User asks a question
- 1: Model asks for count_lines
- 2: Tool returns 42
- 3: Tool is run again and returns 40
span 2..3 "fix with a new fact"
highlight 3
```

## The smallest record

Here is the record in TypeScript, in `src/session.ts`. It has one way to add a fact and one way to read them all. It has no way to change or remove a fact.

```ts
type Fact = { kind: string; text: string }

export class Log {
  private readonly facts: Fact[] = []

  append(fact: Fact): number {
    this.facts.push(Object.freeze({ ...fact }))
    return this.facts.length - 1
  }

  all(): readonly Fact[] {
    return [...this.facts]
  }
}
```

Follow the question "How many lines are in notes.txt?" through it:

1. Append the user's question. It gets position 0.
2. Append the model's request for `count_lines`. It gets position 1.
3. Append the tool's answer, `42`. It gets position 2.
4. Learn that the count was wrong, and append a new fact. The corrected answer, `40`, gets position 3.

Fact 2 still says `42`. The record now shows the wrong answer and the correction, in the order they happened. `Object.freeze` makes each stored fact read-only. In a TypeScript module, code that tries to assign `facts[2].text = '40'` throws an error. `all()` returns a copy of the list, so a caller cannot remove items from the real one either.

Two rules make this work. Facts only go at the end, so their order is the order of events. Old facts never change, so anything you read from the record stays true.

> **Key idea:** An append-only log is a list where new facts only go at the end and old facts never change.

To **append** means to add an item at the end of a list. It is the only write an append-only log allows.

## How dsh does it

DeepSeek Harness calls its record a session. `docs/subsystems/session.md` describes it as an append-only log that is "the single source of truth" for an agent's history. The `append()` method in `packages/core/session/src/index.ts` (line 806) is the only way to add a fact, and it deep-freezes each fact before it stores it (line 827). The same record passes through three packages:

```inkling
title "Who writes and keeps the record in dsh"
layout flow
loop: box "agent-loop\npackages/core/agent-loop"
session: db "dsh-session\npackages/core/session" yellow
file: db "session-persistence-jsonl\npackages/session"
loop -> session : "append a fact"
session -> file : "copy each new fact"
circle session
step 1: loop "The agent loop produces facts as it works"
step 2: session "The session package keeps them in order"
step 3: file "A storage package copies them to disk"
```

## What you have now

You have a record that only grows, where the order of facts is the order of events. Each fact here is a `kind` and some `text`, which is too loose to rebuild a request. What exact shape should one fact have?
