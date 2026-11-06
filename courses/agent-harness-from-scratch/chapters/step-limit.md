# Step limit: a cap that stops a loop running forever

`runTurn` has one exit: a reply with no tool calls. The model decides when that happens. But models get confused. One might read the same file again and again, sure the answer is in it. Another might keep asking for files that are not there. Each step costs money and seconds, and nothing in your code ever says "enough". What stops it?

## Three stories, then call me

Picture a parent leaving a babysitter with a rule: "Read him stories until he falls asleep. If he is still awake after three, stop and call me." Usually he is asleep after one. The rule exists for the night he is not. It does not make him sleepy. It only makes sure the evening ends, and that someone finds out.

```inkling
title "How a step limit ends a turn"
layout down
model: box "Model"
tool: box "Tool"
reply: box "Final reply"
stop: box "Step limit reached"
model -> tool : "Ask for a tool"
tool --> model : "Return result"
step 1: model "The model asks for a tool"
step 2: tool "The tool returns its result"
step 3: reply "No tool calls means the turn ends"
step 4: stop "Too many steps means the turn also ends"
model -> reply : "Reply without tool calls"
model -> stop : "Reach the maximum steps"
circle stop
```

A step limit is that rule for a turn. You pick a maximum number of steps. If the model is still asking for tools when the turn reaches it, your program stops the turn and says so plainly.

The picture stops holding in one place. A child who stays awake is not doing anything wrong. A long-running turn might be. But it might also be an honest, large task that needs many steps. A limit cannot tell the two apart. Choose it high enough for real work and low enough to cap the cost of a confused model.

## What a runaway costs

Say the model keeps reading the same file of about 500 tokens. Every step adds another copy to the history, and every request resends the whole history.

- Step 1 sends 0 copies of the file. Step 2 sends 1. Step 8 sends 7.
- Over 8 steps that is 0 + 1 + 2 + ... + 7 = 28 copies, about 14,000 tokens of the same file.

The cost grows faster than the number of steps, because each step carries all the ones before it. Left alone, the history keeps growing until it no longer fits the context window.

## Adding the cap

Swap the endless `while (true)` for a counted loop.

```ts
// src/loop.ts
export async function runTurn(history: Message[], userText: string, tools: Tool[], maxSteps = 8) {
  history.push({ role: 'user', content: userText })
  const schemas = tools.map(({ name, description, parameters }) => ({ name, description, parameters }))
  for (let step = 1; step <= maxSteps; step++) {
    const { message } = await complete(history, schemas)
    history.push(message)
    if (!message.toolCalls?.length) return message.content
    for (const call of message.toolCalls) {
      console.error(`[step ${step}/${maxSteps}] ${call.name} ${call.arguments}`)
      const tool = tools.find((t) => t.name === call.name)!
      const output = await tool.execute(JSON.parse(call.arguments), new AbortController().signal)
      history.push({ role: 'tool', toolCallId: call.id, content: output })
    }
  }
  const note = `Stopped after ${maxSteps} steps without a final answer.`
  history.push({ role: 'assistant', content: note })
  return note
}
```

Walk through the runaway with `maxSteps = 8`. Steps 1 to 8 each ask for the same file, and each prints a line ending in `/8`. After step 8's results are added, the `for` loop ends. The program adds a short assistant message and returns it. The user sees "Stopped after 8 steps without a final answer." instead of a program that never returns.

Two details matter. First, the stop is reported, not hidden. The user learns the turn did not finish and can rephrase or ask to go on. Second, every tool call that ran still got its result before the loop stopped. The history stays valid, so the next turn can continue from it.

A turn that finishes normally is untouched. The index.txt question still ends in 3 steps, well under 8.

> **Key idea:** A step limit is a maximum number of steps per turn; when it is reached, the program ends the turn and says so, so a confused model cannot run up cost forever.

**In DeepSeek Harness:** its agent loop has no built-in cap on steps per turn. A small harness like yours has no other guard yet, so it should add one.

## What you have now

Turns are made of steps, and a step limit bounds how many one turn may take. But your loop still assumes every tool call succeeds. What happens when the model asks for a file that does not exist, and `readFile` throws?
