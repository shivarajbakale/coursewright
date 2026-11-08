# MCP server: an outside system pi connects to

Until now every tool was code you wrote inside an extension. But many systems already offer tools: a cluster, a documentation site, a file store. Must you write a wrapper for each one, once for every agent that wants it?

Think of a standard wall socket. Any lamp, kettle or charger with the right plug works in any room, and nobody rewires the house for each device. **MCP**, the Model Context Protocol, is a standard plug for tools. A program that follows it can offer its tools to any agent that speaks the same standard. The comparison differs in one way: a socket gives power to anything that fits, but an agent should not use every tool that fits. You still choose which tools the model may reach.

pi has an MCP client built in. A program that offers tools is an MCP server. You list servers in a file named `mcp.json`. For one expert, the file sits in its agent folder, as `agents/<name>/mcp.json`. A trusted project can also have `.pi/mcp.json`.

Here is the example from the pi docs:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "docs": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" }
    }
  }
}
```

The first server is a command that pi starts. The second is a web address that pi calls, with a token taken from an environment variable. Each tool of a server becomes a pi tool named `mcp__<server>__<tool>`. Any character outside letters, digits and `_` becomes `_`.

Now a question appears. A server may offer fifty tools. Putting all fifty in front of the model costs context and gives it more to misuse. The **exposure** of a server or tool decides how the model reaches it. It has four values:

- `direct`: the tool is declared to the model like a built-in tool.
- `deferred`: the tool is declared only after the model finds it with the `tool_search` tool.
- `codemode`: the tool is reachable only from scripts that the model writes. This is the default.
- `hidden`: the tool is registered but nobody can reach it.

```inkling
title "From mcp.json to the model"
layout flow
cfg: box "agents/k8s/mcp.json"
client: box "pi MCP client"
srv: box "Server: cluster"
tools: box "mcp__cluster__get_pods"
model: round "Model" green
cfg -> client -> srv -> tools
tools -> model : "exposure decides"
highlight tools
step 1: cfg "You list the server in mcp.json"
step 2: client "pi starts or calls the server"
step 3: srv "The server reports its tools"
step 4: tools "Each tool gets a prefixed name"
step 5: model "Exposure decides which tools the model can reach"
```

A short illustration for the Kubernetes expert. The server name `cluster` and the command `kube-mcp` are placeholders, not a real server:

```json
{
  "mcpServers": {
    "cluster": {
      "command": "kube-mcp",
      "exposure": "direct",
      "toolExposure": { "delete_*": "hidden" }
    }
  }
}
```

The server's tools are `direct`. The `toolExposure` entry overrides this for each tool whose name matches `delete_*`, and hides it. The key may be an exact tool name or a pattern where `*` matches any characters.

Two facts keep this safe. A call to an MCP tool goes through pi's normal tool path, so the guards you write still apply. And a result larger than 20 KB is cut before the model reads it.

You manage servers with `pi mcp add`, `remove`, `list`, `login` and `logout`.

> **Key idea:** An MCP server offers tools to pi through mcp.json, and each tool's exposure decides how the model reaches it.

## How pi does it

- The config files are read in packages/coding-agent/src/extensions/mcp/config.ts:146-150. The example config is at packages/coding-agent/docs/mcp.md:46-60.
- The name rule is at packages/coding-agent/src/extensions/mcp/tools.ts:79-92. The 20 KB cut is at packages/coding-agent/src/extensions/mcp/tools.ts:51.
- The four exposures and `toolExposure` are described at packages/coding-agent/src/extensions/mcp/index.ts:9-16 and packages/coding-agent/docs/mcp.md:193-217.
- MCP calls use the normal tool path, so guards apply (packages/coding-agent/src/extensions/mcp/index.ts:20-21).

## What you have now

You can connect an outside system and choose how much of it the model sees. It builds on the allowlist, which also controls what a session may use. One exposure, the default, offers tools only to scripts. What is such a script, and why would a model write one?
