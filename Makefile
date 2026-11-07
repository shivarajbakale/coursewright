# Standard targets called from AGENTS.md / CLAUDE.md.
# Honors $NPM_BIN, otherwise uses `npm` from PATH.

NPM ?= $(if $(NPM_BIN),$(NPM_BIN),npm)

.PHONY: setup type-check lint ui-lint plan-lint capability-lint doc-links storybook-lint skill-lint a11y feature-plan test ui-probe ui-shots check dev build clean help commit-feature doc-lint loop-lint course-check course-import course-schema

help:
	@echo "Targets:"
	@echo "  setup       npm install"
	@echo "  type-check  tsc --noEmit"
	@echo "  lint        eslint (max-warnings 0)"
	@echo "  ui-lint     design-system contract (no hand-rolled primitives)"
	@echo "  plan-lint   planning contract (plans validate, FEATURE-PLAN.md in sync)"
	@echo "  prose-report clarity and concision per course (DIR=courses/x for one)"
	@echo "  capability-lint          knowledge contract (the Mantine map matches the packages and the source)"
	@echo "  doc-links   source contract (the map cites Mantine's own docs, recently read)"
	@echo "  storybook-lint           story contract (titles, states, controls, docs freshness)"
	@echo "  skill-lint  instruction contract (the skills describe the app this is)"
	@echo "  a11y        axe-core accessibility gate (WCAG 2.2 AA)"
	@echo "  feature-plan render PLAN=<x>.feature-plan.json into FEATURE-PLAN.md"
	@echo "  test        vitest run"
	@echo "  ui-probe    layout + hierarchy probe in real chromium"
	@echo "  ui-shots    same probe, writing PNGs to .ui-probe/shots/"
	@echo "  check       setup + type-check + lint + ui-lint + plan-lint + capability-lint + doc-links + storybook-lint + skill-lint + test + ui-probe + doc-lint + loop-lint (full baseline)"
	@echo "  dev         vite dev server"
	@echo "  build       production build (tsc && vite build)"
	@echo "  clean       remove dist + node_modules"

setup:
	$(NPM) install

type-check:
	$(NPM) run type-check

lint:
	$(NPM) run lint

# The design-system contract: Mantine owns colour, border, radius, elevation
# *and* layout — there is no second styling system — and no screen hand-rolls a
# primitive Mantine already ships. See scripts/ui-lint.mjs.
ui-lint:
	$(NPM) run ui-lint

# The planning contract: a feature plan is a checked artifact, not a note. Every
# *.feature-plan.json validates, FEATURE-PLAN.md matches a fresh render of its
# source (it is generated — never hand-edit it), and a planned feature is
# registered in feature_list.json. See scripts/plan-lint.mjs.
plan-lint:
	$(NPM) run plan-lint

# The knowledge contract: the Mantine capability map every skill routes through
# still describes the installed packages, this repo's files, every component the
# source imports, and every component @mantine/core ships — one that is neither
# routed nor refused fails the build. See scripts/capability-lint.mjs.
capability-lint:
	$(NPM) run capability-lint

# The source contract: the capability map cites Mantine's own documentation and
# says when it was last read. `--online` additionally fetches every link.
doc-links:
	$(NPM) run doc-links

# The story contract: every shell composite carries a taxonomy title, at least
# three named stories, an explicit layout parameter, and argTypes wherever it
# takes args. See scripts/storybook-lint.mjs.
storybook-lint:
	$(NPM) run storybook-lint

# The skills and principles are what an agent reads before it writes. This
# fails the build when they teach a styling system the app no longer has.
# See scripts/skill-lint.mjs.
skill-lint:
	$(NPM) run skill-lint

# The accessibility gate documented in docs/principles/wcag-2.2-aa.md. Mounts
# each page under a memory router and asserts zero axe violations. The suite
# also runs inside `make test`; this target is the focused re-run the principle
# doc and the ux-prepass skill point at.
a11y:
	$(NPM) run test -- src/__tests__/a11y.test.tsx

# Render a feature plan into the reviewable FEATURE-PLAN.md. The `plan-feature`
# skill authors the JSON; this is the same command it runs, so a human can
# re-render after hand-editing the plan.
#   make feature-plan PLAN=invoices.feature-plan.json
feature-plan:
	@test -n "$(PLAN)" || (echo "usage: make feature-plan PLAN=<x>.feature-plan.json" && exit 2)
	node scripts/feature-plan.mjs $(PLAN) -o FEATURE-PLAN.md

test:
	$(NPM) run test

ui-probe:
	$(NPM) run ui-probe

# Same run, but each measured view is written out as a PNG for the
# ui-evaluator subagent to score. The evaluator reads only these, never the diff.
ui-shots:
	VITE_UI_PROBE_SHOTS=1 $(NPM) run ui-probe

doc-lint: ## Instruction budget — the harness files stay small, true and non-duplicating
	npm run doc-lint

loop-lint: ## Goal contracts — the definition of done was written first, and something ran against it
	npm run loop-lint

check: setup type-check lint ui-lint plan-lint capability-lint doc-links storybook-lint skill-lint test ui-probe doc-lint loop-lint

# Courses written by a coding agent, as a folder (docs/authoring-courses.md).
#   make course-check DIR=courses/x    make course-import DIR=courses/x ARGS=--replace
course-check:
	@test -n "$(DIR)" || (echo "usage: make course-check DIR=<course folder>" && exit 2)
	cd agent && uv run python -m app.cli check "$(abspath $(DIR))" $(ARGS)

course-import:
	@test -n "$(DIR)" || (echo "usage: make course-import DIR=<course folder> [ARGS=--replace]" && exit 2)
	cd agent && uv run python -m app.cli import "$(abspath $(DIR))" $(ARGS)

prose-report: ## Clarity and concision per course: sentence length and each STE check's flags per 100 sentences
	cd agent && uv run python -m app.cli prose-report $(if $(DIR),$(abspath $(DIR)),$(abspath $(wildcard courses/*)))

course-schema:
	@cd agent && uv run python -m app.cli schema

dev:
	$(NPM) run dev

build:
	$(NPM) run build

clean:
	rm -rf dist node_modules

commit-feature: ## Commit the work for any feature that just reached `passing` (runs make check first)
	node .claude/hooks/commit-feature.mjs
