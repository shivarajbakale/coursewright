# Sandbox modes: read-only, workspace-write or full access

The shell tool runs any command with your permissions. A cleaned environment hides your API key, but it does not stop `rm -rf ~` or a write to `~/.bashrc`. Asking a person about every command would make the agent slow and the person tired. You want one clear rule for a whole session, such as "commands may change files in this project and nowhere else". How do you name where a command may write?

## Keys for a house sitter

Think of leaving your flat with a house sitter. You can give them no keys at all, so they can only look through the window. You can give them the key to the spare room, where they may move things. Or you can give them every key. You choose one of three before you leave, and you do not phone them about each door.

In a harness, the sitter is a command or a file tool, and the three choices are three named modes. The comparison differs in one way that matters a lot. A locked door stops the sitter from looking as well as touching. A mode in dsh only limits writing. In every mode, a command can still read any file your user can read, and it can still use the network.

```inkling
title "What each mode allows, for workspace /home/ana/app"
layout compare
columns "read-only", "workspace-write", "danger-full-access"
row "Write app/src/x.ts": no, yes!, yes
row "Write /tmp/build.log": no, yes, yes
row "Write ~/.bashrc": no, no!, yes
row "Read ~/.ssh/id_rsa": yes, yes, yes
row "Send a web request": yes, yes, yes
step 1: write-app-src-x-ts "Only the wider modes may change project files"
step 2: write-bashrc "workspace-write refuses writes outside the write roots"
step 3: read-ssh-id-rsa "No mode stops reading"
step 4: send-a-web-request "No mode stops the network"
```

## The smallest mode check

Here is the policy in `src/sandbox.ts`. A policy is a mode plus the workspace folder, and it produces the **write roots**: the folders under which a write is allowed.

```ts
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access'
export interface SandboxPolicy { mode: SandboxMode; workspaceRoot: string; extraRoots?: string[] }

export function writeRoots(policy: SandboxPolicy): string[] | 'all' {
  if (policy.mode === 'danger-full-access') return 'all'
  if (policy.mode === 'read-only') return ['/dev/null']
  return ['/dev/null', policy.workspaceRoot, ...(policy.extraRoots ?? []), '/tmp', tmpdir()]
}

export async function mayWrite(policy: SandboxPolicy, path: string): Promise<boolean> {
  const roots = writeRoots(policy)
  if (roots === 'all') return true
  const real = await realpath(dirname(path))
  return roots.some(root => real === root || real.startsWith(root + sep))
}

export function resolvePolicy(session: Session, defaultMode: SandboxMode): SandboxPolicy {
  return { mode: session.lastSandboxMode() ?? defaultMode, workspaceRoot: session.cwd }
}
```

The file tools call `mayWrite` before every write and edit. `/dev/null` is in every list because shells write to it to throw output away. `realpath` follows links first. Without it, a link `app/keys` that points at `~/.ssh` would let a write escape the workspace.

Trace three writes in a session whose workspace is `/home/ana/app`, with the default mode `workspace-write`:

1. Write `/home/ana/app/src/x.ts`. Its folder is under the workspace root, so the write is allowed.
2. Write `/home/ana/.bashrc`. Its folder `/home/ana` is under no write root, so the tool refuses with an error.
3. Switch the session to `read-only` with a `sandbox/mode` event, then write `src/x.ts` again. The only root is `/dev/null`, so this write is refused too.

The switch in step 3 is an event in the record, so a resumed session gets the same mode back. The mode is checked for each call, so two sessions with different modes can run at the same time.

> **Key idea:** A sandbox mode names where a session may write: nowhere, under the write roots, or everywhere; it never limits reading or the network.

## How dsh does it

The three modes are `SandboxMode` in `packages/sandbox/sandbox/src/index.ts` (line 30). Its comment says: "Network and process visibility are outside this vocabulary." `writableRoots` in `src/roots.ts` (lines 97-100) adds `/tmp` and the system temp folder to the workspace roots. `ctx.sandboxPolicy` in `packages/sandbox/sandbox-policy` resolves each call: an approved mode, then the session's last `sandbox/mode` event (`src/session-mode.ts`, line 33), then the deployment default. That default is `read-only` in the plugin itself, `workspace-write` in the base bundle and `danger-full-access` in `sdk-minimal`. The file fence in `packages/fs/fs-sandbox` refuses with `FS_SANDBOX_DENIED`, and its comment says: "Reads pass through untouched: every mode permits reading."

```inkling
title "Who reads the mode in dsh"
layout flow
policy: box "sandbox-policy\nctx.sandboxPolicy" yellow
fs: box "fs-sandbox\nfile writes"
bash: box "tool-bash\ncommands"
log: db "Session record\nsandbox/mode"
log -> policy : "last switch"
policy -> fs : "mode + root"
policy -> bash : "mode + root"
circle policy
step 1: log "A mode switch is an event in the record"
step 2: policy "One service resolves the mode and root for each call"
step 3: fs, bash "File tools and commands read the same policy"
```

## What you have now

A session now has one mode that names its write roots, and the file tools enforce it inside the harness. A command is different: `bash -c "echo x > ~/.bashrc"` writes from inside its own process, where the harness's check never runs. What can stop a running command from writing outside its roots?
