#!/usr/bin/env node
/**
 * SessionStart harness hook (rocketship).
 *
 * Surfaces the project's harness on every session start: points the agent at
 * the startup + verification paths and names the current highest-priority
 * unfinished feature from feature_list.json. Emits `additionalContext` so the
 * guidance lands in the model's context, not just the terminal.
 *
 * Dependency-free: reads feature_list.json with the Node stdlib only. Never
 * throws — a missing/damaged feature_list still yields a useful pointer.
 *
 * Note: this intentionally does NOT auto-run ./init.sh. Installing + building on
 * every session start is heavy and user-hostile; instead it reminds the agent
 * to run it. See DECISIONS.md (2026-07-01, harness-004).
 */
import { readFileSync } from "node:fs";

function currentFeature() {
  try {
    const fl = JSON.parse(readFileSync("feature_list.json", "utf8"));
    const rank = { in_progress: 0, blocked: 1, not_started: 2 };
    const open = (fl.features || [])
      .filter((f) => f.status !== "passing" && f.status !== "cancelled")
      .sort(
        (a, b) =>
          (rank[a.status] ?? 3) - (rank[b.status] ?? 3) ||
          (a.priority ?? 99) - (b.priority ?? 99),
      );
    return open[0] || null;
  } catch {
    return null;
  }
}

const f = currentFeature();
const featureLine = f
  ? `Current feature: ${f.id} — ${f.title} (status: ${f.status}).`
  : "No open feature in feature_list.json (all passing or none defined).";

const context = [
  "This project ships the rocketship agent harness.",
  "Startup: run `./init.sh` to install dependencies and verify the baseline.",
  featureLine,
  "Work one feature at a time and verify with `make check` before you stop.",
  "Read AGENTS.md, claude-progress.md, and feature_list.json before making changes.",
].join(" ");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: context,
    },
  }),
);
