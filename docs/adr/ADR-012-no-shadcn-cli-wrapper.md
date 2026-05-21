# ADR-012 — No custom shadcn CLI wrapper; use a ContentGrid registry + lint + conventions

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

The component library lives in `packages/ui` and is built on shadcn/ui (ADR-003). Adding a primitive or pattern means running `pnpm shadcn add <name>` and following project conventions: file placement (`primitives/` vs `patterns/`), kebab-case files / PascalCase exports, mandatory story (ADR-009), SPDX header at OSS time, and — for feature modules — the stability flag (ADR-006).

Two questions came up:

1. Should we publish ContentGrid-specific patterns (`EntityCard`, `DataTable`, `FilterSidebar`, HAL-Forms field renderers, `PdfHighlightOverlay`, etc.) so they're consumable by `shadcn add`?
2. Should we wrap the shadcn CLI in a ContentGrid-specific tool (e.g. `cg ui add <name>`) that enforces conventions automatically — file placement, story scaffolding, header injection, stability-flag wiring?

These are different decisions and warrant separate answers.

## Decision

**Yes to a ContentGrid component registry. No to a wrapper CLI.**

1. **Publish a ContentGrid registry** under `packages/ui` (or hosted at a known URL) so `pnpm shadcn add @contentgrid/entity-card` works natively. shadcn supports custom registries as a first-class feature; we use it as designed.
2. **Do not build a wrapper CLI** around `shadcn add`. Conventions are enforced by lint, code review, and per-package `CLAUDE.md`, not by intercepting the vendor command.
3. **Allow a trivial `package.json` recipe** if a deterministic post-step (e.g. story scaffold) is genuinely repetitive: `"ui:add": "shadcn add $1 && pnpm gen:story $1"`. A six-line recipe is not a wrapper — it's a documented one-liner with no version/help/dispatch overhead.

## Why a registry, but not a wrapper

**Registry — high leverage, low maintenance.**

- shadcn already supports custom registries. We're using the tool as designed, not extending it.
- Versioned independently from `packages/ui` if we want.
- Same `shadcn add` command works for upstream primitives and our patterns. One mental model.
- Agents and humans use the same command they'd use in any shadcn project. No project-specific CLI knowledge needed to onboard.

**Wrapper CLI — low leverage, ongoing maintenance.**

- We'd own a tool that has to keep pace with shadcn upstream. shadcn iterates quickly; wrappers go stale on minor bumps.
- Most of what a wrapper would enforce has a cheaper home:

| Concern                           | Wrapper would do                     | Where it actually belongs                                                           |
| --------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------- |
| Stability flag set on new feature | inject into generated `package.json` | ESLint rule (Phase 1.9) — runs on every PR, not only at scaffold time               |
| Mandatory story per component     | scaffold `*.stories.tsx` alongside   | `eslint-plugin-storybook` + custom rule that flags exports without a story          |
| SPDX header on every source file  | inject on add                        | Pre-commit script (`lint-staged`) — covers files added by any path, not just shadcn |
| Correct folder placement          | resolve target dir                   | per-package `CLAUDE.md` for agents + reviewer catches the rest                      |
| Re-export from `index.ts`         | edit barrel file                     | per-package `CLAUDE.md` + lint rule that flags un-exported public modules           |

- Wrapping the vendor CLI hides shadcn from contributors. When something breaks, the first debug step becomes "what did the wrapper actually run?" — friction every contributor pays.
- Conventions belong in lint and code review. Lint rules survive shadcn version bumps; wrappers don't.

## What this means in practice

**For adding a primitive (upstream shadcn component):**

```
pnpm --filter @contentgrid/ui shadcn add button
```

Then follow the `CLAUDE.md` checklist: kebab-case file, story, re-export from `index.ts`. Lint catches the rest in CI.

**For adding a ContentGrid pattern (consumed from the CG registry):**

```
pnpm shadcn add @contentgrid/entity-card
```

Same command, pulls from the CG registry. Story comes with the registry entry; no scaffolding needed.

**For composing a new pattern locally:**

```
# write packages/ui/src/patterns/relation-section.tsx
# write packages/ui/src/patterns/relation-section.stories.tsx
# add to packages/ui/src/index.ts
```

No CLI involved. Reviewer + lint enforce conventions.

## Counter-pattern to avoid

Don't confuse "no wrapper CLI" with "no automation." Specific repetitive post-steps can earn a small script — the test is "does this need its own help text and version?" If yes, it's a wrapper and we're not building it. If no, it's a recipe in `package.json` and that's fine.

Also: don't grow the registry into a place for one-off project glue. If a "pattern" is only used in one feature, it lives in `packages/features/<feature>/` — not in the registry. The registry is for _reusable_ patterns across generic + experimental + custom apps.

## Consequences

**Positive:**

- Zero wrapper to maintain. shadcn upstream changes don't break our tooling.
- Contributors learn shadcn, not a project-specific CLI. Onboarding to other shadcn projects is transferable.
- Conventions are enforced where they're stronger (lint runs on every PR; the wrapper would only run at scaffold time).
- The CG registry becomes a real asset — versioned, reusable, OSS-publishable when the OSS release lands.

**Negative / accepted:**

- The CG registry is itself something to maintain. Mitigated by keeping its surface tight: only patterns that are reused across tracks; nothing one-off.
- Contributors must remember conventions instead of having them auto-applied. Mitigated by lint coverage + reviewer catch + per-package `CLAUDE.md`.
- New convention enforcement (e.g. SPDX headers) requires writing a lint rule or pre-commit script, not editing one CLI. Slightly more setup work, but it covers all paths into the repo, not just shadcn.

## Reconsider when

- The deterministic post-add logic grows past ~3 steps with branching. Then a small node script (still not a wrapper CLI) is justified.
- Multiple ContentGrid repos consume the same conventions and a registry alone can't capture them. Then a shared script package may earn its keep.
- Lint coverage proves insufficient — i.e. measured contributor errors that lint can't catch. So far, all known concerns have a lint rule path.
- shadcn itself stops being a fit and we move to a different primitives source. Then this ADR is replaced wholesale.

---

**Hub:** [[README|ADR Index]]
