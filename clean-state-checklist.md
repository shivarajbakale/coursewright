# Clean State Checklist

Run through this before ending any session.

- [ ] `./init.sh` still works from a fresh shell.
- [ ] `npm run type-check` exits 0 (no TypeScript errors).
- [ ] `npm run lint` exits 0 (no errors, no warnings — the lint script runs with `--max-warnings 0`).
- [ ] `npm run test` exits 0.
- [ ] `BLUEPRINT.md` reflects current scope (revisions appended if scope shifted).
- [ ] `claude-progress.md` has an entry for this session.
- [ ] `feature_list.json` reflects what is actually passing vs unverified.
- [ ] No half-finished step is left undocumented (note it under "Known
      risk or unresolved issue" if you must stop mid-flight).
- [ ] No debug code remaining (`console.log`, commented-out blocks, `TODO(me)`).
- [ ] No temp files in the repo (screenshots, scratch JSON, `.swp`).
- [ ] All intended changes are committed.
- [ ] The next session can continue without manual repair.
