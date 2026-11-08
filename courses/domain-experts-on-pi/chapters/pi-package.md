# Package: shipping an expert with pi install

Your SQL pack now has a prompt, a skill, a template and code that adds tools. They sit in several folders. A colleague wants the same expert on another machine. Copying folders by hand goes wrong, and the copy falls behind your changes. How do you ship the parts as one unit that installs with one command?

Think of a flat-pack furniture box. The box holds the boards, the screws and the manual, and a shop can send it to any address. The comparison differs from pi in one way. A flat-pack box holds everything you need, but a pi package cannot hold your settings, your tool servers or your system prompt.

A pi **package** bundles four kinds of part: extensions, skills, prompt templates and themes. A theme is a set of colours for the screen. You describe the package in `package.json` with a `pi` field that lists paths for each kind. A package may also use plain folders named `extensions/`, `skills/`, `prompts/` and `themes/`.

The manifest has no field for settings, tool servers or the system prompt. Those come from the pack's own code or from the agent folder. A package is a way to move parts, not to move a whole configuration.

```inkling
title "What a pi package can and cannot carry"
layout mindmap
- Package
  - Extensions
  - Skills
  - Prompts
  - Themes
  - Settings, servers, system prompt
step 1: package "A package is one unit that installs together"
step 2: extensions "Code that adds tools and rules"
step 3: skills "Procedures the model reads"
step 4: prompts "Templates behind slash commands"
step 5: themes "Colours for the screen"
step 6: settings-servers-system-prompt "These three cannot ship in a package"
cross settings-servers-system-prompt
```

You install with **pi install**. It is the command that fetches a package and adds it to settings. The source can be one of three kinds:

- `npm:<name>` for a package on npm.
- A git URL, such as `git:github.com/user/repo@v1`.
- A local path.

The command `pi install <source>` adds the package for the user. With `-l`, it writes to the project's `.pi/settings.json` instead.

Here is the `fleet` case. `packs/sql/package.json` holds:

```json
{ "name": "@fleet/sql-pack", "version": "0.1.0",
  "pi": { "extensions": ["./extension.ts"], "skills": ["./skills"], "prompts": ["./prompts"] },
  "peerDependencies": { "@earendil-works/pi-coding-agent": "*", "typebox": "*" } }
```

The `pi` field names the tool code, the skills folder and the prompts folder. Now you install it into the SQL agent folder:

```ts
// shell command, shown as a string for this lesson
const cmd = "PI_CODING_AGENT_DIR=agents/sql pi install ./packs/sql";
```

pi adds the package to the settings of `agents/sql/`. The prompt still comes from `--system-prompt packs/sql/prompt.md`, because a package cannot carry it.

Note the `peerDependencies`. pi's own packages go there with the version `"*"`. They never go in `dependencies`.

> **Key idea:** A package bundles extensions, skills, prompts and themes, installs with pi install from npm, git or a folder, and carries no settings or prompt.

## How pi does it

The manifest is a `pi` field in package.json with `extensions`, `skills`, `prompts`, `themes` and `changelogPath` (packages/coding-agent/src/core/pi-manifest.ts:4-12). It has no field for MCP, settings or the system prompt (pi-manifest.ts:4-10). The convention folders are described in packages/coding-agent/docs/packages.md:48-77. The source forms are in packages/coding-agent/src/core/package-manager.ts:1592-1617. The flags for `pi install` are in packages/coding-agent/src/cli/args.ts:290-295. The peerDependencies rule is in packages/coding-agent/docs/packages.md:105-117.

## What you have now

You can ship a pack's skills, templates and tool code as one package that installs from npm, git or a folder. The prompt and the settings stay with the agent folder. The package lists a file called `extension.ts`. What does an extension contain, and how does it add a tool to pi?
