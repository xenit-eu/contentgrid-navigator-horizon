# ADR-004 — Forms: drop JSONForms, build a HAL-Forms→shadcn renderer set

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

The original navigator uses JSONForms v3.6.0 (pinned exact) with eight custom renderers to drive entity edit/create forms. The prototype replaced this with a custom `useFormFields` hook and shadcn-native fields, but currently ignores HAL-Forms `_templates` entirely — driving forms from profile metadata instead. That's a real correctness bug (server-controlled form semantics are lost).

Backend already publishes `@contentgrid/hal-forms`, which parses `_templates` into a typed `HalFormsTemplate` / `HalFormsProperty` structure. So the heavy parsing work is already done upstream by Xenit.

We need to decide: keep JSONForms, port it as-is, or commit fully to a shadcn-native renderer set on top of `@contentgrid/hal-forms`.

## Decision

**Drop JSONForms. Build a small HAL-Forms→shadcn bridge in `@contentgrid/navigator-data` plus a renderer set in `packages/ui`.**

- The bridge lives at `packages/navigator-data/src/form-fields/create-form-to-render-fields.ts` (Phase 5A.1 artefact) and maps `HalFormsTemplate` from `@contentgrid/hal-forms` → `RenderFieldDescriptor[]` consumable by our renderers. It stays in `@contentgrid/navigator-data` — not `packages/ui` or `packages/features` — because both of those packages are forbidden from importing `@contentgrid/hal-forms` directly (ADR-007's two-layer model); the folder is named `form-fields/`, not `schema/`, to avoid colliding with the unrelated Zod-validated app-config schema that also lives in this package.
- The renderer set covers: text, number, datetime, enum (single + multi), typeahead (prefix-match remote), file upload, range pair (date/number), relation (to-one + to-many).
- Forms drive from `_templates.create-form` / `default-form`, not profile metadata.

## Why drop JSONForms

- **Pinned-exact dependency** (`3.6.0`) means we're stuck on a release line. Upgrade is its own project.
- **Ajv + JSON Schema** runtime is heavy and only partially leveraged — we use a fraction of its validation surface.
- **Custom renderers** in JSONForms are awkward to write against modern React: imperative tester functions, ranks, and the `dispatch` model don't compose well with hooks-first code.
- **Styling integration** — JSONForms' MUI bridge is what we're migrating _away_ from. The vanilla bridge requires re-skinning every renderer anyway.
- **HAL-Forms ≠ JSON Schema.** `_templates` is the actual server contract. Round-tripping it through JSON Schema loses information (e.g. relation link semantics) and adds translation layers.
- **`@contentgrid/hal-forms` already exists.** The parsing problem is solved. JSONForms would be a second parsing layer we don't need.

## Why custom renderers (vs. another forms library)

- **TanStack Form** was considered (Phase 5A spike). Solid, headless, type-safe — but it's a forms-state library, not a renderer set. We'd still write every shadcn-native field component. Adoption adds API surface without solving our actual problem.
- **React Hook Form** — similar story. Good for app-level form ergonomics, but we need _server-driven_ fields, not user-defined schemas.
- **Hand-rolled with `useFormFields`** (current prototype direction) — already on this path, just incomplete. Closing the gap is cheaper than introducing another library.

We can adopt TanStack Form _inside_ a renderer later if we hit a state-management ceiling. Not as a starting point.

## Scope of the renderer set

Driven by the Phase 0.5 entity-profile audit. Expected types:

- text (single + multiline), email, password, url
- number, integer
- datetime (date, time, date+time)
- enum (single + multi-select)
- typeahead (debounced remote search, prefix match)
- range pair (`date~from` / `~until`, `num~gte` / `~lte`)
- file upload (with XHR progress, cancel, retry)
- relation (to-one picker, to-many list, with unlink-all)

If the audit surfaces a shape with no clean shadcn-native equivalent (rare oneOf/anyOf, conditional rendering driven by other field values), we either: (a) implement a focused custom renderer, or (b) escalate as out-of-scope before Phase 5 commits. No silent gap.

## What is lost by dropping JSONForms — honest inventory

The deep-dive in analysis §3A catalogues five specific capabilities that JSONForms provides out-of-the-box and that the custom renderer must address explicitly:

1. **Built-in conditional rules.** `rule.effect: HIDE | SHOW | DISABLE | ENABLE` against a JSON-pointer `scope` — field B disappears when field A == X. The new renderer must implement a hand-rolled predicate layer (e.g. `react-hook-form` `watch` + condition). Cost is proportional to how often production `_templates` actually use conditionals — Phase 0.5 task 0.5.3 catalogues this.
2. **Layout primitives.** `Categorization` (tabs), `Group` (fieldset), nested layouts. HAL-Forms does not carry layout hints today; if any customer schema injected layout via JSON UI Schema, that is lost.
3. **`oneOf` / `anyOf` polymorphic forms.** JSONForms has dedicated renderers for discriminated unions. The new renderer must reimplement per-case if production entity profiles use polymorphism. Phase 0.5.3 catalogues whether they do.
4. **Ajv validation cohesion.** JSONForms binds Ajv errors to controls by JSON pointer. Replacement is Zod derived from `FieldDescriptor` — equivalent capability, different idiom, real porting effort for any custom keyword logic.
5. **An external ecosystem.** Stack Overflow answers, GitHub issues, third-party renderer packages. The custom renderer is bespoke — every problem is our problem.

## The rejected middle path: keep JSONForms, swap renderer set

This option was explicitly examined: write a `@contentgrid/jsonforms-shadcn-renderers` package, register it in place of `@jsonforms/material-renderers`, keep the JSON-Schema translation layer.

Why it does not pay off:

- **You still write a complete renderer set.** Every primitive (text, select, checkbox, date, file, HAL-link picker, array, oneOf) needs a shadcn-native renderer with a tester. That is the same effort as the `FieldDescriptor` switch — minus the type safety, plus the framework boilerplate.
- **You still carry JSONForms' weight.** The bundle keeps `@jsonforms/core` + `@jsonforms/react` + Ajv + redux-bridging code, all of which exist purely to dispatch into renderers we wrote. ~80–100 KB gzipped of pure overhead.
- **You inherit the version-coupling risk.** JSONForms v3 → v4 forces a renderer rewrite anyway (the `tester` API changes between majors); an ongoing upgrade obligation in exchange for a layer we no longer need.
- **The HAL-Forms → JSON-Schema translator stays forever.** It is the most fragile piece of the existing navigator. Owning the direct HAL → `FieldDescriptor` mapping removes it.

Rejected. The middle path keeps JSONForms' costs and discards its benefits.

## Phase 0.5 audit as gating clause

The audit (task 0.5.3) catalogues `oneOf` / `anyOf`, `rule.effect`, custom Ajv keywords, and `Categorization` layouts across all production entity profiles.

- **Audit shows minimal usage** (expected): proceed with the HAL-Forms-native renderer as planned.
- **Audit shows significant usage** with no clean shadcn equivalent: escalate before Phase 5A starts. Options at that point: (a) widen Phase 5A scope for the missing renderer cases, (b) keep the original navigator on those entity profiles until equivalents exist, (c) reopen this decision. The team decides; this ADR records the gating condition.

## Surviving open risk

If a customer's HAL-Forms `_templates` evolves post-cutover and introduces a shape the renderer's discriminated union does not cover, the failure mode is a TypeScript compile error (visible) rather than a silent fallback (invisible). This is intentional. The renderer must have an explicit "unhandled descriptor type" path that fails loudly in dev and renders a marked placeholder in production so the gap surfaces early. Tracked as a renderer-design requirement under Phase 5A.

## Consequences

**Positive:**

- Forms are driven by the actual server contract (`_templates`), not by profile metadata.
- Bundle drops by ~135 KB gzipped (JSONForms core + Ajv + MUI renderers removed; react-hook-form + Zod already required).
- Renderers compose with shadcn primitives, so style consistency is automatic.
- `FieldDescriptor[]` is a TypeScript discriminated union — exhaustiveness checked by the compiler. Bad combinations fail at compile time, not at runtime.
- `FieldDescriptor[]` is small enough that customer-track apps can override individual renderers without forking the library.
- AI-friendliness: a new field type is a code change in three files (type, renderer case, story). JSONForms requires understanding tester ranking, `JsonFormsRendererRegistryEntry` shape, and redux-style state plumbing.

**Negative / accepted:**

- We own the renderer set forever. Mitigated by keeping the surface narrow and tested.
- HAL-Forms shapes that JSONForms handled "for free" need explicit support. The Phase 0.5 audit exists to catch these early.
- Round-trip parity test (5A.6) becomes mandatory — if the renderer set diverges from the original's behaviour on a known entity, that's a regression we ship into customer hands.
- Conditional field logic requires explicit predicate code where JSONForms provided declarative `rule.effect`. Scope confirmed by Phase 0.5.3 audit.

## Reconsider when

- HAL-Forms grows shapes we can't render with a small custom set (e.g. recursive nested objects, deeply conditional fields). Then evaluate TanStack Form _or_ a focused new renderer.
- Phase 0.5 audit reveals heavy `oneOf` / `anyOf` or `rule.effect` usage that Phase 5A cannot absorb cleanly. Then options (a), (b), or (c) from the gating clause above apply.
- A customer requires a forms-builder UX (end-users defining their own forms). That's a different problem domain.

---

**Hub:** [[README|ADR Index]]
