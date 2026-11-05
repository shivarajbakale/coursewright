<!-- agent-protocol -->
> **Agent working protocol:** read [AGENTS.md](AGENTS.md) before coding, and
> [ARCHITECTURE.md](ARCHITECTURE.md) before composing a screen. Session state is
> `feature_list.json` + `claude-progress.md`. Start with `./init.sh`, verify with
> `make check`.

# CLAUDE.md

[AGENTS.md](AGENTS.md) is the contract and this file does not repeat it. Below is
only what is specific to running as Claude Code here.

## Hooks are watching

- **SessionStart** prints the current state. A red baseline is the first fix.
- **Stop** blocks if a feature reached `passing` and the work is uncommitted, and
  runs `make check` and evidence-lint, then commits. `HARNESS_STRICT=0` skips that;
  `ROCKETSHIP_AUTOCOMMIT=0` switches the tier off, and neither ever pushes.

## What bites here

- **`plan-feature` comes first for UI work, and `ux-prepass` last.** Both are
  skills in `.claude/skills/`; `make plan-lint` fails an unplanned change.
- Mantine is the design system, and the only one; `src/components/` holds only
  this product's own composites. Colour, border, radius, elevation and layout
  are all Mantine's — `make ui-lint` rejects a utility class anywhere.
- `src/lib/auth.ts` is a local demo shim, not a real auth client. MSW answers a
  Better Auth-shaped session endpoint; swap the file, keep the exports.

Verification beats speed: done means `make check` green and evidence written.
