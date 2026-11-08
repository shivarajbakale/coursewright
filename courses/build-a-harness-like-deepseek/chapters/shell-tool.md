# Shell tool: running a command for the model

File tools let the model read and change files with a version check. Most real tasks also need commands: `npm test`, `git status`, `ls src`. One tool that runs any command covers all of them. That tool starts a new process on your computer, and a new process copies settings from the program that starts it, including your secrets. How does the harness run a command for the model, and what does that command get to see?

## A visitor's pass

Think of a building that lets a contractor in for a day. Reception gives the contractor a pass that opens the workshop and the lift. Reception does not hand over the manager's key ring, even though the contractor is inside the same building. When the job is done, the contractor reports what they did and what went wrong.

In a harness, the contractor is the command, the building is your computer, and the pass is the set of settings the new process receives. The comparison differs in one way. Reception chooses which doors to open. The harness starts from a copy of its own settings and removes the ones that look like secrets. Anything it does not remove, the command can read.

Every process carries a list of named text settings called **environment variables**, such as `PATH` (where to find programs) and `HOME` (your home folder). A child process gets a copy of its parent's list. The harness's own list holds `DEEPSEEK_API_KEY`, the key that pays for every model call.

```inkling
title "What the command's process receives"
layout compare
columns "Harness process", "Command process"
row "PATH and HOME": yes, yes
row "DEEPSEEK_API_KEY": yes, no!
row "GITHUB_TOKEN": yes, no!
row "DSH_PROFILE": yes, no
row "TERM=dumb, PAGER=cat": no, yes
step 1: path-and-home "Ordinary settings pass through, so programs still run"
step 2: deepseek-api-key "Names that look like secrets are removed"
step 3: dsh-profile "The harness's own settings are removed too"
step 4: term-dumb-pager-cat "Settings that keep output plain are added"
```

## The smallest bash tool

First, the clean copy of the environment, in `src/subprocess.ts`:

```ts
const SENSITIVE = /KEY|PASSWORD|SECRET|TOKEN/i

export function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && !SENSITIVE.test(name) && !name.toUpperCase().startsWith('DSH_')) env[name] = value
  }
  return env
}
```

Then the tool, in `src/shell.ts`. The helper `run` starts the process, collects at most `maxBytes` of output, and kills the process when its timeout passes.

```ts
const bash = defineTool({
  name: 'bash',
  description: 'Run a bash command in the workspace.',
  parameters: {
    command: { type: 'string', required: true },
    timeoutMs: { type: 'number', description: 'Defaults to 120000, at most 600000.' },
  },
  output: {
    schema: { type: 'object', additionalProperties: false, properties: {
      exitCode: { type: 'integer', required: true }, output: { type: 'string', required: true } } },
    render: (_args, v) => [{ type: 'text', text: v.exitCode === 0 ? v.output : `${v.output}\n[exit code: ${v.exitCode}]` }],
  },
  async execute(args, exec) {
    return run('bash', ['-c', args.command], {
      cwd: workspaceRoot,
      env: { ...cleanEnv(), NO_COLOR: '1', TERM: 'dumb', PAGER: 'cat' },
      timeoutMs: Math.min(args.timeoutMs ?? 120_000, 600_000),
      maxBytes: 64_000,
      signal: exec.signal,
    })
  },
})
```

Trace `bash "npm test"` where 1 test fails:

1. Build the environment. `DEEPSEEK_API_KEY` and `GITHUB_TOKEN` match the pattern and are dropped. `PATH` stays, so `npm` is found.
2. Start `bash -c "npm test"` in the workspace with a 120,000 ms timeout.
3. Collect the output. It is 3 kilobytes, well under the 64,000-byte cap.
4. Return the value `{ exitCode: 1, output: "... 1 failing" }`. The model reads the output and the line `[exit code: 1]`.

The result is not an error result. The tool did its job: it ran the command and reported what happened. A failing test is information for the model. The tool throws only when it could not run the command at all, for example when `bash` is missing.

This tool does not declare itself safe to run in parallel. A command can change any file, so every `bash` call runs alone.

> **Key idea:** A shell tool runs one command in a child process with a cleaned environment and returns its exit code and output.

## How dsh does it

The tool is `bash` in `packages/shell/tool-bash/src/index.ts` (line 369). It hands the command to `ctx.shell`, which `packages/shell/bash-local` provides with a default timeout of 120,000 ms, a cap of 600,000 ms and 64,000 output bytes (`src/index.ts`, lines 102-104). bash-local adds `NO_COLOR`, `TERM=dumb`, `PAGER` and `GIT_PAGER` (lines 27-32). `scrubbedParentEnv` in `packages/subprocess/subprocess/src/index.ts` (line 66) removes names matching `/KEY|PASSWORD|SECRET|TOKEN/i` (line 47) and every `DSH_*` name. Then `packages/shell/shell-env` adds a fresh, trusted set such as `DSH_SHELL=1` and `DSH_SESSION_ID` (lines 152-167).

```inkling
title "The shell packages in dsh"
layout flow
tool: box "tool-bash\nthe bash tool"
env: box "shell-env\ntrusted DSH_*"
shell: box "bash-local\nctx.shell"
sub: box "subprocess-local\nctx.subprocess" yellow
proc: box "bash -c command" green
tool -> env : "collect"
tool -> shell -> sub -> proc
circle sub
step 1: tool "The tool reads the model's command"
step 2: env "It asks shell-env for the harness's own trusted settings"
step 3: shell "bash-local applies timeouts, caps and plain-output settings"
step 4: sub, proc "The subprocess service removes secrets and starts the process"
```

## What you have now

The model can run any command, with secrets removed from its environment and its exit code reported. Nothing yet limits what that command does to your files: `rm -rf ~` runs with all of your permissions. How do you name where a command may write?
