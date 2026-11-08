# Prompt sections: ordered pieces of the system prompt

As you saw with the logged system prompt, the harness writes its instructions to the record as one message. But who writes that text? In a harness built from plugins, the bash tool knows how bash must be used, and the read tool knows how files must be read. No single file knows everything. How do many plugins write one prompt?

## A shared notice board

Think of a notice board in a shared kitchen. Each person pins one card. The cards have numbers in the corner, and the person who tidies the board puts them in number order every morning. When someone moves out, their card comes down. Nobody rewrites the other cards.

In the harness, each plugin is one person, each card is a section of the system prompt, and the number is the section's order. The tidy person is a small service that sorts the sections and joins them into one text. The picture differs in one way: the harness rebuilds the whole prompt before every step, so a plugin can give a function that writes its text fresh each time.

```inkling
title "Sections sorted by order"
layout stack
- harness:identity (order -1000)
- deployment:persona-prefix (order 0)
- tool bash (order 1000)
- tool read (order 1100)
- deployment:persona-suffix (order 10200)
brace harness-identity-order-1000..deployment-persona-prefix-order-0 "who the agent is"
steps auto
```

## The smallest version

Here is the service in mini-dsh, in `src/prompt.ts`. A section has a unique name, an order and a text.

```ts
export interface PromptSection {
  name: string
  order: number
  text: string | (() => string)
}

export class SystemPrompt {
  private sections = new Map<string, PromptSection>()

  section(s: PromptSection): () => void {
    if (this.sections.has(s.name)) throw new Error(`section "${s.name}" is already registered`)
    this.sections.set(s.name, s)
    return () => { this.sections.delete(s.name) }
  }

  render(): string {
    return [...this.sections.values()]
      .sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
      .map(s => (typeof s.text === 'function' ? s.text() : s.text))
      .filter(text => text.length > 0)
      .join('\n\n')
  }
}
```

Trace three plugins that start in this order: read, identity, bash.

1. The read plugin adds `tool:read` with order 1100. It is the only section, so it comes first for now.
2. The identity plugin adds `harness:identity` with order -1000. The sort puts it before `tool:read`.
3. The bash plugin adds `tool:bash` with order 1000. The sort puts it between the other two.
4. `render()` returns the identity text, a blank line, the bash text, a blank line and the read text.

The order in which plugins start does not change the result. Because of this, the same set of plugins always makes the same bytes. As you saw with prefix caching, identical bytes at the start of a request give a cache hit.

The `section()` method returns a disposer. When the bash plugin stops, its disposer runs, and the next `render()` has no bash text. A section with empty text is dropped, so it leaves no extra blank lines.

> **Key idea:** A prompt section is a named, numbered piece of the system prompt; the harness sorts all sections by number and joins them into one text.

```inkling
title "From sections to the record"
plugins: box "tool-bash, tool-fs"
service: box "ctx.systemPrompt"
loop: box "agent-loop"
record: db "system/message"
plugins -> service : "section()"
service -> loop : "assemble"
loop -> record : "log if changed"
steps auto
```

## How dsh does it

The service is `packages/core/system-prompt/src/index.ts`, available to plugins as `ctx.systemPrompt`. `section()` (line 484) throws on a duplicate name and returns the disposer. One table, `SECTION_ORDERS` (line 136), holds every order number in one place: `HARNESS_IDENTITY` is -1000, `TOOL_BASH` 1000 and `TOOL_READ` 1100. Equal orders sort by name, and `renderPrompt()` (line 296) drops empty sections and joins the rest with a blank line. Before each step, `assemble()` (line 620) runs the `system-prompt/assemble` waterfall hook, so a listener can change the sections before the loop renders them.

## What you have now

The system prompt is now a sorted list of sections that plugins add and remove, and it gives the same bytes each time. Some facts change during a session, such as the time, and in the system prompt they would make the cache miss. Where do changing facts go?
