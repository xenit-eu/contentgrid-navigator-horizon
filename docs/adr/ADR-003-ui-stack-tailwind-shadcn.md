# ADR-003 — UI stack: Tailwind v4 + shadcn/ui (drop MUI + tss-react)

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

The original navigator uses MUI v6 + tss-react (Emotion). The prototype already adopted Tailwind v4 + shadcn/ui + Radix primitives. The migration must commit one way or the other for the modernised navigator.

We also need a component-library home that supports a multi-app monorepo (generic + experimental + future custom apps), an agent-driven dev workflow, and an eventual Apache-2.0 release.

## Decision

- **Styling:** Tailwind v4 + CSS variables for design tokens.
- **Primitives:** shadcn/ui — copied into `packages/ui/src/primitives/`, owned by us.
- **Lower-level building blocks:** Radix UI (consumed only inside `packages/ui`).
- **Patterns:** composed from primitives, live in `packages/ui/src/patterns/`.
- **Drop:** MUI, tss-react, Emotion (and any direct Material consumers in the prototype).

Apps consume `packages/ui` via workspace protocol. No app imports Radix directly.

## Why this stack

- **Tailwind v4** — utility-first removes whole categories of styling decisions (BEM, css-in-js naming, scoping). Tokenised via CSS vars, themed via the `:root` layer. Excellent DX, small runtime cost, agent-friendly.
- **shadcn/ui owned-copy model** — we get well-built primitives without owning the dependency. The "no library, just code" approach means we can change anything without forking. Radix underneath gives us a11y compliance without writing it ourselves.
- **One stylesheet per app** — Tailwind preset shared from `packages/ui/tailwind-preset.ts`, so generic, experimental, and future custom apps all theme through the same token surface.

## Why MUI is dropped

- Heavy bundle, slow tree-shake.
- Theming via `createTheme` + Emotion is a learning tax for contributors who already know Tailwind.
- Pinned tss-react keeps the prototype tied to a deprecated abstraction.
- Component customisation via `sx` and `styled` is harder to reason about than `className` composition for an agent reading the code.
- Migration to Material 3 would be its own multi-week project. Switching to Tailwind+shadcn now is cheaper than upgrading MUI.

## Alternatives considered

| Option                                            | Why rejected                                                                                                           |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **MUI v6 (status quo, port architecture)**        | Bundle, theming friction, tss-react dead-end. Doesn't help OSS release ergonomics either.                              |
| **Mantine**                                       | Capable, but a full library — we'd own the version-bump pain without the ownership benefits of shadcn's copy-in model. |
| **Headless UI + Tailwind**                        | Smaller a11y surface than Radix; we'd reinvent more.                                                                   |
| **Park UI / Ark UI**                              | Too new. Switching costs are high once primitives are in.                                                              |
| **Plain CSS modules + a small primitive library** | Reasonable, but loses the Tailwind productivity boost and the agent-friendliness of utility classes.                   |

## Consequences

**Positive:**

- Clear separation: `packages/ui` is the only place Radix appears.
- Bundle is dramatically smaller than the MUI baseline.
- Shadcn primitives are well-documented externally — agents and human contributors share the same reference material.
- OSS consumers can swap our copies for theirs with no library version-pin negotiation.

**Negative / accepted:**

- Owning the primitives means owning their bug fixes. Mitigated by `pnpm shadcn add` to re-pull when upstream improves a component.
- One-time migration cost to convert any remaining MUI usage in the prototype.
- A11y is on us — we can't blame a vendor. The Phase 3 axe-core audit per primitive is the mitigation.

## Reconsider when

- Tailwind v5 / shadcn equivalent introduces a breaking change we can't absorb cheaply.
- A customer mandate forces a specific design system (Material, Fluent, Carbon). At that point we wrap that system inside `packages/ui` patterns rather than leak it across the codebase.

---

**Hub:** [[README|ADR Index]]
