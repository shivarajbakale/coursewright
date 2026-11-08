# Domain expert: an agent narrowed to one job

You can now follow how pi works: a loop, a model, tools and a session log. Run it on a database question and it answers like a general coding assistant. It has a shell and a file editor, and it knows nothing about your shop. How do you turn that general helper into one that is good at a single job?

Think of a hospital. A general doctor sees every patient, but a heart surgeon has a smaller toolbox, a fixed set of rules and years of practice on one organ. The surgeon is better at that one job because the job is narrow. The comparison differs from pi in one way. A surgeon learns by years of practice. An agent gets its narrow knowledge from files that you write and that pi reads on every run.

Plain pi is a general coding assistant. Its default prompt describes one, and its default tools are `read`, `bash`, `edit` and `write`. To narrow it, you keep pi's loop and session, and you change five things:

1. The **role**: a prompt that says who the agent is and what rules it follows.
2. The **knowledge**: procedures and notes about the domain.
3. The **tools**: only the actions this job needs.
4. The **guards**: rules in code that block a bad action before it runs.
5. The **checks**: tests that prove the expert does its job.

Narrow helps in two ways. Fewer tools means fewer wrong actions, and a shorter prompt leaves more room in the context window. The knowledge matters too. A model cannot guess that, in your shop, revenue excludes refunded orders. That rule has to live in a file.

```inkling
title "What makes a domain pack"
layout mindmap
- Domain pack
  - Role prompt
  - Knowledge
  - Tools
  - Guards
  - Checks
step 1: domain-pack "One folder of files turns pi into one expert"
step 2: role-prompt "The prompt says who the expert is"
step 3: knowledge "Procedures and notes carry the domain rules"
step 4: tools "Only the actions this job needs"
step 5: guards "Code blocks the bad actions"
step 6: checks "Tests prove the expert works"
```

This course builds one repository called `fleet`. It holds a shared folder `packs/base/` and one pack for each of three experts. Each expert runs from its own folder under `agents/`.

- The expert for SQL answers questions about a shop database. Its pack is `packs/sql/`.
- The expert for Kubernetes inspects a cluster and changes it with care. Its pack is `packs/k8s/`.
- The expert for trading research tests ideas on price data. Its pack is `packs/quant/`.

All three use the same model. Only the pack differs. If the SQL expert gives a bad answer, you look at its pack, not at the model.

The name for the files that make one expert is a **domain pack**.

> **Key idea:** A domain pack is the set of files that narrows pi to one job: its role, knowledge, tools, guards and checks.

## How pi does it

pi's default prompt describes a general coding assistant (packages/coding-agent/src/core/system-prompt.ts:155-156). Its default tools are `read`, `bash`, `edit` and `write` (packages/coding-agent/src/core/settings-manager.ts:85). pi's README says it "skips features like sub-agents and plan mode" and leaves them to extensions (README.md:19). So you build an expert by adding to pi, not by changing pi's code.

## What you have now

You know that a domain expert is the pi loop with a narrow role, its own knowledge, a small set of tools, guards and checks. You also know the three experts you will build in `fleet`. The role comes first, and it sits in the system prompt, so how do you replace pi's opening text with your own?
