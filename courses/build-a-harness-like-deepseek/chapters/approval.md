# Approval: asking a person before a tool runs

A pre-execute listener can return a third decision besides allow and deny: ask. A policy plugin returns it for a call it cannot judge, such as `bash "git push"`. Someone must now answer. In a terminal, a person may be watching, but in a test run at night, nobody is. The harness must also remember later that it asked and what the answer was. Who answers an ask, and what happens when nobody can?

## A bank card at a shop

Think of paying by card in a shop. For a large amount, the terminal phones your bank, and the bank asks you on your phone. You can say yes, say no, or ignore it until the shop gives up. If the terminal has no network, the payment fails. The shop never treats "no answer" as "yes", because the cost of a wrong yes is much higher than the cost of a wrong no.

In a harness, the shop terminal is the tool pipeline, the bank is an approval service, and you are the person at the screen. The comparison differs in one way. A bank's yes covers one payment of an exact amount. A harness's yes covers one exact tool call. A second call with the same arguments must ask again.

```inkling
title "One ask, from start to answer"
layout sequence
pipe: box "Tool pipeline"
appr: box "ctx.approval"
log: db "Session record"
ui: person "Person"
pipe -> appr : "ask about git push"
appr -> log : "approval/asked"
appr -> ui : "allow git push?"
ui --> appr : "yes, once"
appr -> log : "approval/decided"
appr --> pipe : "allowed-once"
steps auto
```

## The smallest approval service

The approval service in `src/approval.ts` returns one of four outcomes: `allowed-once`, `rejected`, `cancelled` or `unavailable`. Only `allowed-once` lets the call run. A screen that can talk to a person adds a listener on the `approval/request` waterfall. The end of the chain returns `unavailable`.

```ts
const OUTCOMES = ['allowed-once', 'rejected', 'cancelled', 'unavailable'] as const
type Outcome = typeof OUTCOMES[number]

export class ApprovalService {
  constructor(private readonly ctx: Context, private readonly policy: 'ask' | 'never' = 'ask') {}

  async request(req: ApprovalRequest): Promise<Outcome> {
    const id = randomUUID()
    req.session.append('approval/asked', { id, toolName: req.toolName, reason: req.reason })
    const outcome = await this.decide(req)
    req.session.append('approval/decided', { id, outcome })
    return outcome
  }

  private async decide(req: ApprovalRequest): Promise<Outcome> {
    if (this.policy === 'never') return 'rejected'
    try {
      const outcome = await this.ctx.waterfall('approval/request', req, async () => 'unavailable')
      return OUTCOMES.includes(outcome) ? outcome : 'unavailable'
    } catch {
      return 'unavailable'
    }
  }
}
```

The pipeline turns every outcome except `allowed-once` into a deny, each with its own reason. With no approval service mounted at all, an ask is a deny too.

Trace one ask for `bash "git push"` in three setups:

1. Run in a terminal whose screen plugin adds an answerer. The person presses y, so the outcome is `allowed-once` and the guards run next.
2. Run headless, with no answerer. The chain reaches its end and returns `unavailable`. The model reads `Error: tool "bash" requires approval, but no approval channel is available`.
3. Run with the policy `never`. The service returns `rejected` before any answerer sees the question.

In all three cases, the record holds one `approval/asked` and one `approval/decided` with the same id. Because the reasons differ, the model can tell a person's "no" apart from "nobody could answer".

To **fail closed** means that when a check cannot get an answer, it refuses. An answerer that throws, or returns a word outside the four outcomes, also gives `unavailable`.

> **Key idea:** An ask goes through an approval service to a person; only allowed-once runs the call, and every missing answer fails closed.

## How dsh does it

The pipeline resolves an ask in `serviceAsk` (`packages/core/tools/src/pipeline.ts`, line 432). It reads `ctx.approval` only if one is mounted, and it denies when none is or when the call has no agent. `ApprovalService.request` in `packages/interaction/user-approval/src/index.ts` (line 242) writes `approval/asked` and `approval/decided` to the session and refuses to run outside an open turn. Its `decide` method (line 293) applies the policy `never` before the `approval/request` waterfall (line 301), and the waterfall ends with `unavailable` (line 309). The default policy is `ask` (line 171).

## What you have now

The pre-execute decision can now ask a person, and every unanswered ask fails closed with a reason the model can read. Once a call is allowed, its body runs, and a body can hang. How does the harness put a time limit on a running tool?
