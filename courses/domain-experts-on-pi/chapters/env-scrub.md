# Environment scrub: keeping keys away from commands

Every bash command starts with a copy of pi's environment variables. That copy includes `DEEPSEEK_API_KEY`. The model needs the key only inside pi, to call the model service. A shell command never needs it. If the model asks for `env`, the key appears in the conversation. How do you hand each command only the variables it needs?

Picture a hotel receptionist who gives a visitor a day pass. The pass opens the lobby and one meeting room. It does not open the manager's office, even though the receptionist holds that key. The picture differs from pi in one way: pi hands a pass to every command on its own, and by default the pass is a copy of the full key ring.

pi gives you a hook for this. A **spawnHook** is a function that bash calls before each command starts. It receives `{ command, cwd, env }` and returns the same three fields. It can change the command, the working folder and the environment. The command then starts with what you returned.

Per command, bash does these steps:

1. Copy the shell environment.
2. Remove inherited variables of the `PI_SESSION_*` kind.
3. Add the current session's values.
4. Call the `spawnHook` with `{ command, cwd, env }`.
5. Start the command with the environment the hook returned.

```inkling
title "The hook filters the environment"
layout flow
penv: box "pi environment with keys"
hook: diamond "spawnHook filter"
cenv: box "Command environment"
penv -> hook : "every variable"
hook -> cenv : "only PATH, HOME and others on the list"
step 1: penv "pi holds all variables, including API keys"
step 2: hook "The hook keeps only the names on your list"
step 3: cenv "The command starts with the short list"
```

Nothing in pi strips secrets by default. Even pi's Gondolin virtual machine example passes host variables through. So the scrub is your job. In the shared folder `packs/base` of `fleet`, `extension.ts` replaces bash with a scrubbed one:

```ts
const keep = ["PATH", "HOME", "LANG", "KUBECONFIG"];
const bash = createBashTool(process.cwd(), {
  spawnHook: ({ command, cwd, env }) => ({ command, cwd,
    env: Object.fromEntries(keep.filter((k) => env[k]).map((k) => [k, env[k]])) }),
});
pi.registerTool({ ...bash, execute: async (id, params, signal, onUpdate) => bash.execute(id, params, signal, onUpdate) });
```

The import is `createBashTool` from `"@earendil-works/pi-coding-agent"`. The registration shape, spreading the tool and forwarding `execute`, is copied from pi's own example.

Follow the filter with a small environment: `PATH`, `HOME`, `DEEPSEEK_API_KEY` and `LANG`. The filter keeps the names on `keep` that have a value. That leaves `PATH`, `HOME` and `LANG`. The key is not on the list, so the command never receives it. A list of allowed names is safer than a list of banned names, because a new secret is dropped without any change to the code.

Test it. Ask the expert to run `env`. The output must not contain `DEEPSEEK_API_KEY`. If it does, the hook is not in place.

The scrub covers only what bash starts. It does not stop a command that reads a key from a file on disk, so combine it with the container from the earlier lessons.

> **Key idea:** A spawnHook runs before each bash command and can rewrite its environment, so a command gets only the variables you allow.

## How pi does it

For each command, bash copies the shell environment, removes inherited `PI_SESSION_*` style variables, adds the current session's values, then calls the `spawnHook` with `{ command, cwd, env }` (packages/coding-agent/src/core/tools/bash.ts:185-211). pi's example `bash-spawn-hook.ts` builds the tool with a `spawnHook` and registers it by spreading the tool and forwarding `execute` (packages/coding-agent/examples/extensions/bash-spawn-hook.ts:16-29). Nothing in pi strips secrets by default, and the Gondolin virtual machine example passes host variables through (packages/coding-agent/docs/containerization.md:157).

## What you have now

You now have three limits that stack: a container for what the process can reach, a backend for where commands run, and a spawnHook for what environment they get. Gates and result rewrites sit on top of them. The expert's rules, tools and limits are now complete, and each one can be tested by hand.
