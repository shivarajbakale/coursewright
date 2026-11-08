# Router: sending each task to the right expert

You have a base pack and a way to hold several experts in one program. A task now arrives as plain text, such as "Why is the web pod restarting?". Which expert should take it, and who decides?

Think of the front desk of a hospital. The receptionist reads your problem and sends you to a department. For a broken arm the answer is clear. For a strange mix of symptoms the receptionist asks you a question instead of guessing. The receptionist also writes down where each person went, so mistakes can be found later.

The picture differs from the field in one way. A receptionist learns from a mistake by thinking about it. A router is code, and it repeats a wrong choice until you change a rule.

A **router** is your program, placed in front of the experts. It reads a task, picks one expert, logs the choice and passes the task on. When it cannot tell, it asks the user. pi has no agent router built in. Its `jev-router.ts` example routes between models, not between agents.

The router works in two stages. This keeps it cheap and predictable.

- Stage one is a list of rules. A task that mentions `kubectl`, `pod` or `deployment` goes to the Kubernetes expert. A rule costs no model call.
- Stage two is a **classifier**: a step that puts an input into one of a few named groups. Here it is a small model call. It must answer with one of `sql`, `k8s`, `quant` or `unsure`.

A model can answer in free text, such as "probably the database one". Your code cannot use that. So you force the answer into the allowed set. The classifier gets one tool, `choose_expert`, with an enum parameter. The tool also ends the turn, so the model cannot ramble. Here is `router/router.ts`:

```ts
import { appendFileSync } from "node:fs";
import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { createAgentSession, SessionManager, type ModelRuntime } from "@earendil-works/pi-coding-agent";
import { experts } from "./experts";

type Choice = "sql" | "k8s" | "quant" | "unsure";
const rules: [RegExp, Choice][] = [
  [/kubectl|\bpod\b|deployment/i, "k8s"],
  [/revenue|orders|customers/i, "sql"],
  [/backtest|moving average/i, "quant"],
];

async function classify(task: string, model: ReturnType<ModelRuntime["getModel"]>): Promise<Choice> {
  let choice: Choice = "unsure";
  const chooseExpert = {
    name: "choose_expert", label: "Choose expert",
    description: "Pick the expert that should take the task",
    parameters: Type.Object({ expert: StringEnum(["sql", "k8s", "quant", "unsure"]) }),
    async execute(_id: string, params: { expert: Choice }) {
      choice = params.expert;
      return { content: [{ type: "text" as const, text: choice }], details: {}, terminate: true };
    },
  };
  const { session } = await createAgentSession({
    model, tools: ["choose_expert"], customTools: [chooseExpert],
    sessionManager: SessionManager.inMemory(),
  });
  await session.prompt(`Choose the expert for this task: ${task}`);
  session.dispose();
  return choice;
}

export async function route(task: string, model: Parameters<typeof classify>[1]) {
  const hit = rules.find(([re]) => re.test(task));
  const choice = hit ? hit[1] : await classify(task, model);
  const reason = hit ? "rule" : "classifier";
  appendFileSync("router/decisions.jsonl", JSON.stringify({ task, choice, reason }) + "\n");
  if (choice === "unsure") return "I am not sure which expert fits. Is this about sql, k8s or quant?";
  await experts[choice].prompt(task);
  return experts[choice].getLastAssistantText();
}
```

The code does five things in order. It tries the rules. If none match, it runs the classifier. It writes one line to `router/decisions.jsonl` with the task, the choice and the reason. If the choice is `unsure`, it asks the user. Otherwise it sends the task to that expert's session.

The log earns its place. When a task goes to the wrong expert, you find the line in `decisions.jsonl`. You then turn that task into a golden task for the router itself.

```inkling
title "How the router picks an expert"
layout flow
task: box "Task"
rules: diamond "A rule matches?"
classifier: box "Classifier"
sql: box "SQL expert"
k8s: box "Kubernetes expert"
quant: box "Quant expert"
ask: box "Ask the user"
task -> rules : "read the text"
rules -> k8s : "kubectl, pod, deployment"
rules -> classifier : "no rule"
classifier -> sql : "sql"
classifier -> quant : "quant"
classifier -> ask : "unsure"
step 1: task "A task arrives as text"
step 2: rules "Cheap rules run first"
step 3: classifier "With no rule, a small model call must pick one name"
step 4: sql, k8s, quant "The task goes to one expert"
step 5: ask "When the classifier is unsure, the user decides"
```

> **Key idea:** A router tries cheap rules, then a classifier that must answer from a fixed set. It logs every choice and asks the user when unsure.

## How pi does it

- Forcing the answer into a set is a pattern from pi's evals. They use a submit tool with `constrainedSampling: { type: "json_schema", strict: "prefer" }` and `terminate: true` (packages/evals/evals/documentation-audit.eval.ts:9-30).
- pi's `jev-router.ts` example routes between models, not agents (packages/coding-agent/examples/extensions/jev-router.ts:1-20).

## What you have now

You have a router: rules, then a classifier limited to four answers, a log of every choice and a question for the user when it is unsure. It joins the base pack and the sessions into one entry point. Some tasks need two experts one after the other. How does one expert's result become the next expert's task?
