# Prompt sections: a system prompt assembled from many plugins

So far the system prompt in `minidsh` is one string written in `src/loop.ts`. Now many parts want a say in it. The shell tool wants to tell the model how the fence reports refusals. The edit tool wants to say "Read a file before editing it." A plugin may add a tool for one project and be unloaded an hour later. If all of them edit one shared string, who removes the edit tool's advice when the edit tool goes away?

## A page built from columns

Picture a newspaper page. Each desk writes its own column and gives it a slot number. The editor does not rewrite anyone's text. At print time the editor lays the columns out in slot order. If a desk closes, its column is gone from the next edition.

A system prompt can work the same way. Each plugin registers a named piece of text with an order number. Just before each request, the harness sorts the pieces and joins them. The picture stops holding at print time. A newspaper prints once a day. The harness lays out the page again at every step, so a section can change between two requests in the same turn.

## A section registry

Add this to a new file, `src/context.ts`:

```ts
export interface PromptSection { name: string; order: number; text: string | (() => string) }

export class SystemPrompt {
  private sections = new Map<string, PromptSection>()

  register(section: PromptSection): () => void {
    this.sections.set(section.name, section)
    return () => { if (this.sections.get(section.name) === section) this.sections.delete(section.name) }
  }

  render(): string {
    return [...this.sections.values()]
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
      .map(s => (typeof s.text === 'function' ? s.text() : s.text))
      .filter(t => t.trim() !== '')
      .join('\n\n')
  }
}
```

`register` returns a disposer, so a plugin can hand it to `ctx.effect` and the section disappears when the plugin unloads. A plugin provides the registry as a service, and each tool plugin adds its own advice beside its own schema:

```ts
const editTool: Plugin = ctx => {
  ctx.effect(() => ctx.get('prompt').register({
    name: 'tool:edit', order: 1300, text: 'Read a file before editing it.' }))
  // ...registers the edit tool itself...
}
```

Trace a session with four sections:

```text
register identity  order -1000   "You are minidsh, a coding agent."
register persona   order 0       "Answer briefly."
register bash      order 1000    "Commands run inside a file sandbox..."
register edit      order 1300    "Read a file before editing it."

render() -> identity, persona, bash, edit   (sorted by order, then name)
unload the edit plugin -> its disposer runs -> next render() has three sections
```

Order numbers leave gaps on purpose. A new tool can slot in at 1100 without renumbering anything. Ties fall back to the name, so the result is the same on every run.

The rendered text still needs to reach the model. `minidsh` records it as a `system/message` event at the start of the session, so derived history puts it first in every request. Keep fast-changing facts, like the time or the working folder, out of sections. A later lesson shows why a system prompt that stays word-for-word the same matters.

> **Key idea:** Prompt sections are named, ordered pieces of text that plugins register and remove; the system prompt is rendered by sorting and joining them, never by editing one shared string.

**In DeepSeek Harness:** `ctx.systemPrompt` is the registry. A central table in `packages/core/system-prompt/src/index.ts` assigns orders: `HARNESS_IDENTITY` -1000, `DEPLOYMENT_PERSONA_PREFIX` 0, `PLAN_POLICY` 500, `TOOL_BASH` 1000, `TOOL_EDIT` 1300, `TOOL_SUBAGENT` 2800, `MCP_SERVERS` 3100 and `DEPLOYMENT_PERSONA_SUFFIX` 10200. Sections may contain `{{variables}}` filled at render time. A section registered for one agent shadows a global one with the same name, which is how one agent gets a different persona. Facts such as `WORKING_DIRECTORY` and `SANDBOX_POLICY` live in a separate list and are logged as their own user-role message, so process-specific paths "stay out of" the system prompt.

## What you have now

You have a system prompt built from sections that arrive and leave with their plugins, using disposers, services and agent scope. It is recorded as the first event of the log. The open question is a repository's own notes: where do a project's instruction files, like a list of build commands, belong?
