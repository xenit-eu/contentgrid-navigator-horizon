# ADR-004 — HAL-Forms form rendering: model-enrichment vs rendering-projection seam

**Date:** 2026-09-04
**Status:** Accepted
**Phase:** 5A — Form rendering
**Refines:** [ADR-007](ADR-007-two-layer-dependency-model.md) (which originally located the "HAL-Forms → `FieldDescriptor[]` bridge" wholesale inside `@contentgrid/navigator-data`).

---

## Context

Navigator renders create / update / search forms directly from HAL-Forms
`_templates`, with no JSON-Schema intermediate (see the migration analysis). The
planned path is `HAL-Forms _templates → FieldDescriptor[] → renderer → DOM`.

Earlier planning (ADR-007) listed the whole "HAL-Forms → `FieldDescriptor[]`
bridge" as a `@contentgrid/navigator-data` responsibility. Writing the ADR that
was referenced-but-never-authored surfaced a contradiction:

- ADR-007's stated goal is that `@contentgrid/navigator-data` stays
  **frontend-agnostic and OSS-publishable** — "reusable in non-navigator
  frontends."
- But `FieldDescriptor`'s `kind` discriminant is, by the templates-inventory
  audit's own words, _"a presentation-layer concept — it tells the renderer what
  widget to draw"_ (`docs/audits/entity-profile-templates-inventory.md` §9.3).

A widget-selection projection is **Navigator's rendering model**. Baking it into
a data-access library that is supposed to serve _any_ frontend pollutes that
library with one particular frontend's presentation concerns.

The word "translation" was hiding **two** layers that sit on different sides of
the frontend-agnostic / presentation line.

## Decision

Split HAL-Forms form handling on the **model-enrichment vs rendering-projection**
seam. The two halves live in different places.

| Layer                                                | Content                                                                                                                                                                                                        | Home                                                     | Nature             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------ |
| **Raw parse**                                        | `name`, `type`, `options` (inline/remote), `required`, `regex`, `multiValue`, `readOnly`, `prompt`, `value`                                                                                                    | `@contentgrid/hal-forms` (Xenit, Layer 1)                | frontend-agnostic  |
| **Model enrichment** — _"what the backend requires"_ | `ProfileAttribute` / `ProfileRelation` linking, relation cardinality (to-one / to-many), relation target collection href + target profile, search-operator parsing, allowed values, required/regex passthrough | `@contentgrid/navigator-data` (extended-forms accessors) | frontend-agnostic  |
| **Rendering projection** — _"how it renders"_        | `FieldDescriptor` type + `resolveFieldDescriptors()` (widget-`kind` projection), the `kind`-aware `FieldRenderer` switch, `LayoutInformation`, `FormContainer`, userPreferences-driven layout                  | app-level `apps/navigator/src/forms/` module             | Navigator-specific |
| **Dumb widgets**                                     | `input`, `select`, `checkbox`, `button`, etc.                                                                                                                                                                  | `@contentgrid/ui` primitives                             | domain-agnostic    |

Concretely:

1. **`@contentgrid/navigator-data` keeps the model-enrichment accessors only.**
   The extended-forms wrappers (`CreateHalFormTemplate`, `SearchHalFormTemplate`)
   that link HAL-Forms properties to profile metadata, classify relations, parse
   search operators, and expose allowed values **stay**. They describe _what the
   backend requires to build a field_ and are useful to any HAL frontend. They
   do **not** emit `FieldDescriptor` and carry no widget-`kind`.

2. **`FieldDescriptor` + `resolveFieldDescriptors()` move to an app-level
   `forms/` module** (`apps/navigator/src/forms/`). This is Navigator's rendering
   model: it maps enriched HAL-Forms semantics to a widget-`kind` discriminated
   union and owns layout and renderer selection.

3. **The `kind`-aware `FieldRenderer` switch lives with the projection**, not in
   `@contentgrid/ui`. `@contentgrid/ui` keeps only dumb form primitives. This is
   consistent with the existing ui rule: _"if a pattern is only used in one
   feature, it belongs in the feature, not the registry"_
   ([packages/ui/CLAUDE.md](../../packages/ui/CLAUDE.md)).

4. **The value/submit contract is unchanged**: form values are held as
   `HalFormValues<T>` and encoded via `halFormCodecs.requireCodecFor(template).encode(values)`,
   then submitted through a `@contentgrid/navigator-data` mutation hook.

## Why the seam falls here

- **`kind` is presentation, everything below it is model.** `resolveFieldDescriptors`
  answers _"which widget?"_ — a Navigator decision. The enrichment accessors
  answer _"what does the backend require?"_ — a decision any frontend shares.
- **Keeps `@contentgrid/navigator-data` frontend-agnostic**, honouring ADR-007's
  own OSS/publish goal instead of contradicting it.
- **No dependency cycle.** Because the `kind`-aware renderers move _with_ the
  `FieldDescriptor` type (out of `@contentgrid/ui`), the graph stays acyclic:
  `@contentgrid/ui` (leaf) ← `@contentgrid/navigator-data` ← app `forms/` module.
  Leaving the type in the app while renderers stayed in `ui` would have created a
  `ui ⇄ forms` cycle; moving them together avoids it.
- **App-level first, extract later.** The projection is Navigator-presentation.
  Per ADR-010 (cutover first, defer packaging), it starts as an app module rather
  than a shared package. It is promoted to a shared package (or
  `packages/features`) only when a second track (`navigator-experimental` or a
  custom app) actually needs it — not pre-emptively.

## What this explicitly does NOT change

- The extended-forms accessors in `@contentgrid/navigator-data` stay put.
- `@contentgrid/hal-forms` (Xenit) remains the raw parser; we do not re-vendor it.
- The `HalFormValues` + codec encode/submit contract is untouched.

## Alternatives considered

1. **Keep the whole bridge in `@contentgrid/navigator-data` (original ADR-007
   wording).** Rejected: embeds a Navigator widget model in a lib meant to be
   frontend-agnostic and OSS-publishable.
2. **Put `FieldDescriptor` + renderers in `@contentgrid/ui`.** Rejected: `kind`
   encodes Navigator-domain semantics; ui primitives must stay domain-agnostic,
   and it would force a `ui ⇄ navigator-data` type dependency.
3. **Put it in `packages/features` immediately.** Deferred, not rejected:
   `packages/features` is stability-gated and per-track; the projection is shared
   by _all_ tracks and is not itself a promotable "feature." Start app-level;
   extract to a shared module if/when a second track consumes it (see trigger).

## Consequences

**Positive:**

- `@contentgrid/navigator-data` stays publish-ready and frontend-neutral.
- One clear home per concern; the renderer `switch` is exhaustiveness-checked in
  the app, next to the layout it drives.
- Model enrichment is reusable by non-Navigator HAL clients.

**Negative / cost:**

- The `forms/` module currently lives in `apps/navigator` only; if
  `navigator-experimental` needs it before extraction, it must import across app
  boundaries or trigger the extraction early.
- Contributors must resist the temptation to "just add a `kind`" inside
  `@contentgrid/navigator-data`; the enrichment accessors must remain
  widget-free.

## Reconsider when

- A second track/app (`navigator-experimental`, a custom app, or the console)
  needs `resolveFieldDescriptors` / the renderers → extract the `forms/` module
  into a shared package (or `packages/features`) at that point.
- HAL-Forms gains real layout metadata upstream → revisit where
  `LayoutInformation` is sourced (today it is app/userPreferences only, because
  the profile carries no layout — see audit §9).
