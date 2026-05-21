# ContentGrid Navigator — Front-End Build Analysis

**Date:** 2026-04-27 (revised 2026-04-29 — cutover-first scope, ADRs extracted; prepared for Xenit review 2026-05-06) (2026-05-07: reframed — the new front-end layer is the deliverable, not the prototype)
**Author:** Nick Van Vynckt
**Repos analysed:**
- `contentgrid-navigator` (existing navigator — feature spec / behaviour reference)
- `contentgrid-navigator-prototype` (architectural reference — idioms, primitives, hooks as starting points)
**Companion docs:** `contentgrid-navigator-migration-roadmap.md`, ADR index (ADRs 001–015, available in prototype repo)

---

## TL;DR

The prototype is **not a behind subset of the original** — it's a parallel rewrite that's already ~80% feature-equivalent on the visible surface, plus has things the original lacks (saved searches, multi-tenant settings, branding, and more). The build is therefore not "port everything, then enhance" — it's **implement the remaining feature gaps in the new app (using the existing navigator as behaviour spec), then harden**. The dominant risks are the AI extraction/PDF-annotation flow (Phase 6B in the roadmap) and the HAL-Forms forms correctness gap (Phase 5A) — not raw line count.

The ~80% figure means that ~80% of the visible feature surface is already prototyped and can be lifted as starting code into the new app; the remaining work is filling gaps from the existing navigator (extraction, classify-create, etc.) into the new app. Appendix B gives a separate estimate: the prototype reflects ~55–65% of what a hardened production navigator needs — that second number measures a different axis: production-readiness (tests, CI, a11y, i18n, RBAC, error boundaries). The new app must close the production-readiness gap regardless. Both numbers are correct and non-contradictory: the prototype looks nearly feature-complete to a user clicking through it, but is substantially incomplete from a production-engineering standpoint. Closing the second gap is where the majority of roadmap effort sits.

---

## 1. Feature gap (existing navigator → new app)

What the **original has that the prototype does not**:

| Feature                                                                              | Original location                                                           | Prototype status                                           | Port complexity                                                              |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **AI extraction flow** (PDF annotation overlay, click-to-fill, multi-LLM, citations) | `src/components/extract/`, `src/components/assistant/`, `ExtractionContext` | Missing                                                    | **High** — bidirectional PDF↔form coupling, no tests, only partly E2E-tested |
| **Classify-create flow** (upload file → AI suggests entity type)                     | `pages/ClassifyCreateInstancePage.tsx`                                      | Missing                                                    | Medium — depends on extraction                                               |
| **Continuous-create mode** (form stays open after save)                              | `CreateEntityInstance` module                                               | Missing                                                    | Low                                                                          |
| **Cursor-based search URL state** (`s.*` filter prefix encoding)                     | `modules/CollectionSearch/`                                                 | Partial — prototype uses TanStack Router state             | Low — convert encoding                                                       |
| **JSONForms-driven dynamic forms**                                                   | `src/components/form/` (8 custom renderers)                                 | Replaced with custom shadcn forms via `use-form-fields`    | N/A — prototype's approach is better, do not port                            |
| **Range filter fields** (date/number ranges)                                         | `RangedJsfFormConvertor`                                                    | Unknown — verify                                           | Low                                                                          |
| **Typeahead autocomplete fields**                                                    | `TypeAheadField`                                                            | Unknown — verify                                           | Low                                                                          |
| **File upload with XHR progress**                                                    | `src/app/api/upload.ts`                                                     | Verify — prototype has FileUploadZone but progress events? | Medium                                                                       |
| **Cross-tab sign-out** (StorageEvent listener)                                       | `src/app/api/oidc.ts`                                                       | Verify                                                     | Low                                                                          |
| **Runtime config injection** (`window.contentGridConfig.v1`)                         | `src/app/config.ts`                                                         | Replaced with Zod-validated config + localStorage          | N/A — prototype's is better                                                  |
| **Video / non-PDF preview** (dashcam, video player, non-Office formats)              | Rendition service integration (added for ADL insurance use case)            | Not present in prototype                                   | Low — port as-is; Phase 0.5 audit enumerates exact formats in production     |

**Scope decision — video and non-PDF preview:** video preview and non-Office/non-PDF formats are **ported as-is** from the existing navigator if already in production (in-scope), but no new format support is added during the cutover migration. Phase 0.5 audit enumerates which file types the existing navigator currently previews (image variants, video poster + player, Office docs via rendition service, PDF native). Any format not currently rendered in production is explicitly out of scope.

**PDF byte-range / progressive streaming is a separate feature — explicitly out of scope for the cutover.** The existing navigator does lazy page rendering but downloads the full PDF first. Byte-range streaming (HTTP Range requests that deliver pages on demand without a full download) is a new capability that requires an auth-model change: the current OIDC token-per-request approach does not fit, since byte-range streaming requires a BFF (Backend-For-Frontend) with session cookies to maintain auth state across Range requests. This was raised in the 2026-05-08 meeting (Ronny: "byte loading or page at a time"; Roel: existing renderer does lazy page rendering but downloads full PDF first; Thijs: "it has something to do with BFF and session cookies"). Treat as a separate future initiative — do not scope into Phase 6A. See also Risk register item on scope creep.

What the **prototype has that the original does not** (keep, do not regress):

- 5-tab settings (branding, display, entities, saved searches, import/export)
- Cross-entity full-text search with grouped results
- Saved searches (drag-to-reorder, pin to sidebar, import/export)
- Recent activity feed, recent items
- Theme toggle (light/dark via next-themes)
- Keyboard shortcut system

*(Dashboards and AI chat assistant exist in the prototype but are scoped as demo-only — see roadmap §Out of scope.)*

**Real work**: only the extraction/PDF-annotation flow is genuinely hard. Everything else is mechanical.

---

## 2. Architectural verdict

The prototype's stack is **strictly more modern** than the original on every axis:

| Dimension       | Original                                     | Prototype                                           | Winner    |
| --------------- | -------------------------------------------- | --------------------------------------------------- | --------- |
| Router          | React Router v7                              | TanStack Router (file-based, type-safe, code-split) | Prototype |
| State           | Context + ad-hoc reducers                    | Zustand + TanStack Query                            | Prototype |
| Styling         | MUI v6 + tss-react (Emotion)                 | Tailwind v4 + shadcn/ui + Radix                     | Prototype |
| Forms           | JSONForms v3.6.0 (pinned exact, fragile)     | Custom field builder over shadcn (TanStack Form spike in Phase 5A) | Prototype |
| Config          | `window.contentGridConfig` runtime injection | Zod-validated + localStorage                        | Prototype |
| Type strictness | `noUnusedParameters` disabled                | Full strict                                         | Prototype |

**Recommendation: do not port the original's architecture. Implement only the missing features in the new app, lifting the prototype's idioms as starting points.** MUI/JSONForms going away is a feature, not a loss.

TanStack Query owns server state; Zustand owns client UI state. Jotai was considered and rejected — atom-level derivation isn't justified by navigator's coarse-grained client state.

---

## 2A. Delivery model

The modernised navigator ships from a single monorepo in three coordinated tracks: **generic** (`apps/navigator`, production domain, stable features only), **experimental** (`apps/navigator-experimental`, separate domain, all stability tiers), and **custom** (`apps/<customer>/`, per-customer bespoke UIs scaffolded from shared packages — *deferred to first-customer trigger, see ADR-010*). Features live in `packages/features/<name>/` and carry an explicit stability flag (`experimental → candidate → stable`). The generic build enforces that it imports only `stable`-flagged features via an ESLint rule and CI bundle audit (Phase 1). See ADR-006 and roadmap §Three-track delivery model for the full promotion workflow.

**Custom-track apps cannot live in the public OSS monorepo.** A custom app for a specific customer contains prospect or customer names, bespoke UI decisions, and potentially NDA-bound business logic — none of which belongs in an Apache-2.0 public repo. Thijs confirmed this explicitly: "I don't think it's okay to put in prospect names." The concrete model: custom apps live in **private per-customer repos** and consume `@contentgrid/ui`, `@contentgrid/navigator-data`, and `packages/features/*` as **published npm dependencies** (not workspace protocol). This makes the `@contentgrid/*` publish ceremony a hard prerequisite for the first custom-track customer app, not an indefinite deferral. ADR-010 defers Phase 8 scaffolding to the first-customer trigger — that trigger simultaneously fires the publish ceremony for `@contentgrid/navigator-data` and `@contentgrid/ui`. The `pnpm workspace:*` protocol is fine during the cutover scope (Phases 0–7, 10) when all consumers live inside the monorepo; it cannot survive the OSS publish event for a custom-track app that lives outside it. See ADR-013 for the full private-repo delivery model and rejected alternatives.

The data layer follows a **two-layer dependency model** (ADR-007). Layer 1 is the seven existing `@contentgrid/*` packages consumed as `peerDependencies` — backend release cadence drives them. Layer 2 is a new `@contentgrid/navigator-data` composition package that adds navigator-side composition on top: TanStack Query hooks, ETag/`If-Match` optimistic concurrency, the HAL-Forms → `FieldDescriptor[]` bridge, Zod-validated app config, and MSW handler fixtures. **During the cutover scope (Phases 0–7, 10), it is consumed via `pnpm workspace:*` — no publish ceremony.** The publish workflow (semver, changesets, registry) is deferred to first out-of-tree consumer (custom-track app, ContentGrid console, or OSS release) per ADR-010.

The **ContentGrid console** (admin/operator UI: IAM, deployments, data-model management) stays in a separate repo and consumes `@contentgrid/ui` via npm when published — not the navigator monorepo. See ADR-008 for rationale and publish-trigger conditions.

---

## 3. Component library — recommendation

The plan (shadcn/ui + Radix + Storybook in a separate package) is sound, with refinements:

**Recommended structure** (pnpm workspaces monorepo):

```
contentgrid-navigator/                  # new monorepo root
├── packages/
│   ├── ui/                              # the component library
│   │   ├── src/
│   │   │   ├── primitives/              # shadcn-derived (button, dialog, …)
│   │   │   ├── patterns/                # composed (DataTable, EntityCard, FilterSidebar)
│   │   │   ├── tokens/                  # design tokens (CSS vars, presets)
│   │   │   └── index.ts
│   │   ├── tailwind-preset.ts           # share Tailwind v4 config
│   │   └── package.json
│   ├── navigator-data/                  # @contentgrid/* re-exports + hooks
│   │   ├── hal-hooks/                   # useEntity, useEntityList, useRelation, …
│   │   ├── auth/                        # OIDC provider, token supplier
│   │   └── config/                      # Zod schemas + provider
│   └── eslint-config/                   # shared lint rules
├── apps/
│   ├── navigator/                       # the new app (production deliverable)
│   └── storybook/                       # standalone Storybook host
└── pnpm-workspace.yaml
```

**Pick: Storybook 9** (latest, Vite builder, supports Tailwind v4 and the new flat-config ESLint), because Chromatic visual regression pairs perfectly with the "AI-driven dev" goal — agents can write components and a CI bot can visually approve.

**Don't reinvent shadcn.** Keep the shadcn philosophy (copy components, own them). The `packages/ui` directory becomes your owned copy. Use the `shadcn` CLI to scaffold new ones into the package.

pnpm workspaces is the ceiling for monorepo tooling. Nx was considered and rejected — it adds a second mental model (project graph, executors, generators) on top of pnpm without payoff at this scale (2 apps + handful of packages), and Nx-shaped code hurts the eventual OSS release. Turborepo can be added later if CI times exceed ~5 min for no-op PRs; revisit Nx only beyond ~5 apps.

**pnpm vs Yarn — vulnerability patching capability.** Yarn was originally chosen for the existing navigator partly because `resolutions` enables forcing a fixed version of a transitively-vulnerable dependency across the whole tree. pnpm has full parity here, plus an additional capability:

- **`pnpm.overrides`** in `package.json` — direct equivalent of Yarn `resolutions`. Supports plain version pinning, parent-scoped selectors (`parent>child`), version-range selectors (`minimatch@<3.0.5`), and nested overrides. `pnpm audit` respects them. This covers every case `resolutions` covered.
- **`pnpm patch <pkg>@<version>` / `pnpm patch-commit`** — generates a `.patch` file checked into the repo and re-applied automatically on install. Use when no fixed version exists upstream and the package source needs a local hot-fix. Yarn 1 has no native equivalent (Berry adds the `patch:` protocol).
- **`pnpm.allowedDeprecatedVersions`** and **`pnpm.packageExtensions`** — finer-grained transitive-dep control than Yarn 1 offers.

Net: pnpm matches Yarn on `resolutions` and is strictly ahead on patching unreleased fixes. The vuln-patching capability is not a reason to stay on Yarn.

---

## 3A. Forms architecture — JSON Forms vs HAL-Forms-native renderer

The "drop JsonForms" decision (ADR 0.4) is the single biggest behavioural change in the new app, and the meeting raised the legitimate question of whether JSON Forms could be retained as an *adapter layer* (swap the MUI renderer set for a shadcn renderer set, keep the rest). This section makes the trade-off explicit so the team can sign off on the call without surprises.

### What JSON Forms actually provides

JSON Forms is a renderer framework built around two inputs:

- A **JSON Schema** (Draft-07) describing data shape and validation.
- A **UI Schema** describing layout (`VerticalLayout`, `HorizontalLayout`, `Group`, `Categorization`), explicit control ordering, and rule-based conditional logic (`condition: { scope, schema }` with `effect: HIDE | SHOW | DISABLE | ENABLE`).

It then routes each control to a registered renderer based on a **tester function** (`(uiSchema, schema) => rank`), with the highest-ranked tester winning. The default packages ship MUI, Vanilla, and AntD renderer bundles. Validation runs through Ajv. State is internal to the JSON Forms tree; the host sees changes via `onChange({ data, errors })`.

In the existing navigator: JSON Forms v3.6.0 (pinned exact), MUI renderer set, 8 custom renderers in `src/components/form/` for ContentGrid-specific controls (HAL-link picker, file upload, etc.), a hand-written **HAL-Forms → JSON-Schema** translator that materialises a JSON Schema from the `_templates` block on every fetch.

### What we lose by dropping JSON Forms

Honest list, not minimised:

1. **Built-in conditional rules.** `effect: HIDE` against a JSON-pointer `scope` is a real feature. Replacing it means the new renderer needs a hand-rolled mechanism for "field B disappears when field A == X". Cost: small if HAL-Forms templates rarely use it (Phase 0.5 audit task 0.5.3 confirms scope), non-trivial if every customer schema relies on it.
2. **Layout primitives.** `Categorization` (tabs), `Group` (fieldset), nested layouts — JSON Forms gives them for free. The new renderer must compose `<Tabs>`, `<Card>`, fieldset wrappers explicitly. Mostly a non-issue (HAL-Forms doesn't carry layout hints today), but if any customer schema injected layout via UI Schema, that's gone.
3. **`oneOf` / `anyOf` polymorphic forms.** JSON Forms has dedicated renderers for discriminated unions and "pick which subschema applies" UIs. The new renderer must reimplement this when an entity profile uses polymorphism. Audit task 0.5.3 catalogues whether production actually does.
4. **Ajv validation cohesion.** JSON Forms binds Ajv errors directly to controls by JSON pointer. Replacement: Zod (or hand-built validators) in the new renderer. Equivalent capability, different idiom, real porting effort for any custom keyword logic.
5. **A known framework with a public ecosystem.** Stack Overflow answers, GitHub issues, third-party renderer packages. The custom shadcn renderer is bespoke — every problem becomes our problem.

### What we gain

1. **Shedding ~150 KB gzipped of runtime** (`@jsonforms/core` + `@jsonforms/react` + `@jsonforms/material-renderers` + Ajv + a-jv-formats + redux internals JSON Forms still ships in v3). The new renderer is ~one-tenth that, even after counting `react-hook-form` + Zod.
2. **No MUI in the bundle.** JSON Forms v3 still depends on MUI v5 transitively via the material renderer set. Keeping JSON Forms means either keeping MUI in the tree (defeats the Tailwind v4 + shadcn migration goal) or writing a complete shadcn renderer set anyway — at which point JSON Forms is just plumbing around our own components.
3. **Direct HAL-Forms → component path, no JSON Schema intermediate.** Today's flow is HAL-Forms `_templates` → translator → JSON Schema → JSON Forms → MUI renderer → DOM. The new flow is HAL-Forms `_templates` → `FieldDescriptor[]` → shadcn renderer → DOM. Two fewer translation layers, fewer places for shape mismatches to hide. The HAL-Forms semantic (allowed values, regex, required, type hints) maps cleanly to shadcn primitives without going through JSON Schema gymnastics.
4. **Type safety end-to-end.** `FieldDescriptor` is a TypeScript discriminated union. The renderer is a `switch` over a closed set of variants — exhaustiveness checked by the compiler. JSON Forms' tester-based dispatch is dynamic and string-typed; bad combinations fail at runtime.
5. **AI-friendliness.** A new `FieldDescriptor` variant is a code change in three files (type, renderer case, story). A new JSON Forms renderer requires understanding the tester ranking, the `JsonFormsRendererRegistryEntry` shape, the redux-style state plumbing — all knowledge an agent has to acquire from documentation. Aligns with the broader "AI-driven development" goal of section 4.
6. **Accessibility floor.** Radix primitives ship correct ARIA + keyboard interaction by default. JSON Forms' MUI renderers are a11y-passable but not consistently audited; the custom MUI renderers in the existing navigator are not audited at all.
7. **Stable peer-dep surface.** JSON Forms v3 → v4 is a major upgrade with renderer-API changes; staying current on JSON Forms is a recurring maintenance tax. Owning the renderer means the only upgrade pressure is shadcn/Radix/Tailwind, which we own anyway.

### Side-by-side comparison

| Dimension | JSON Forms (existing) | HAL-Forms-native shadcn renderer (proposed) |
|---|---|---|
| Schema source | HAL-Forms → translator → JSON Schema → JSON Forms | HAL-Forms → `FieldDescriptor[]` → renderer |
| Translation layers | 3 (HAL→JSON Schema, JSON Schema→UI Schema, UI Schema→renderer) | 1 (HAL→FieldDescriptor) |
| Validation | Ajv + custom keywords | Zod, derived from FieldDescriptor |
| Dispatch | Runtime tester ranking | Compile-time discriminated union |
| Conditional logic | Built-in `rule.effect` against JSON pointer | Explicit predicate on form state (react-hook-form `watch` + condition) |
| Layout primitives | `VerticalLayout`/`Group`/`Categorization` built-in | Compose shadcn `<Card>` / `<Tabs>` / `<Fieldset>` directly |
| `oneOf` / `anyOf` | First-class renderer | Hand-rolled per case (audit-driven, see 5D.7) |
| UI library coupling | Tied to MUI (or rewrite renderer set) | Tied to shadcn/Radix — already chosen |
| Runtime weight (gzip) | ~150 KB (JSON Forms + Ajv + MUI renderers) | ~15 KB (react-hook-form + Zod, already required) |
| Dev velocity for novel field type | Add tester + renderer + register; navigate JSON Forms internals | Add variant to `FieldDescriptor`, add `case` to renderer, write story |
| Type safety | String-typed scopes, dynamic dispatch | Exhaustive switch on union |
| AI-readability | Low (framework-specific patterns) | High (plain switch + shadcn primitives) |
| External ecosystem | Yes (renderer packages, SO answers) | None — bespoke |
| Upgrade tax | JSON Forms major versions + Ajv + MUI | Only shadcn/Radix/Tailwind (already owned) |

### The middle path examined: keep JSON Forms, swap renderer set

Concretely: write a `@contentgrid/jsonforms-shadcn-renderers` package, register it in place of `@jsonforms/material-renderers`, keep the JSON-Schema translation layer. This is what the meeting summary captured as the alternative.

Why it doesn't pay off:

- **You still write a complete renderer set.** Every primitive (text, select, checkbox, date, file, HAL-link picker, array, oneOf) needs a shadcn-native renderer with a tester. That's the same effort as the proposed `FieldDescriptor` switch — minus the type safety, plus the framework boilerplate.
- **You still carry JSON Forms' weight.** The bundle keeps `@jsonforms/core` + `@jsonforms/react` + Ajv + redux-bridging code, all of which exist purely to dispatch into renderers we wrote ourselves. ~80–100 KB gzipped of pure overhead.
- **You inherit the version-coupling risk.** JSON Forms v3 → v4 forces a renderer rewrite anyway (the `tester` API changes between majors); you've taken on a recurring upgrade obligation in exchange for keeping a layer we no longer need.
- **The HAL-Forms → JSON-Schema translator stays in the codebase forever.** It's the most fragile piece of the existing navigator (every HAL-Forms type extension needs translator changes). Owning the direct HAL→FieldDescriptor mapping removes it.

The middle path keeps JSON Forms' costs and discards its benefits. Reject.

### Where this changes if Phase 0.5 finds heavy JSON Forms-only usage

The audit (task 0.5.3) explicitly catalogues `oneOf` / `anyOf`, `rule.effect`, custom Ajv keywords, and `Categorization` layouts in production entity profiles. Two outcomes:

- **Audit shows minimal usage** (expected, based on the existing navigator's own `_templates` shapes): proceed with the HAL-Forms-native renderer as planned. Conditional fields and polymorphism are added per-shape as concrete cases inside the new renderer.
- **Audit shows significant usage** with no clean shadcn equivalent: escalate before Phase 5A starts. Options at that point: (a) widen Phase 5A scope to add the missing renderer cases, (b) keep the original navigator on those specific entity profiles until equivalents exist, (c) reopen the JSON Forms decision. Decision belongs to the team, not to this analysis — but the audit is what gates it.

### Migration approach

1. Phase 0.5: catalogue every distinct field shape currently rendered by JSON Forms in production (audit task 0.5.3).
2. Phase 5A: design `FieldDescriptor` as a closed discriminated union covering every catalogued shape; build the HAL-Forms → `FieldDescriptor[]` mapper inside `@contentgrid/navigator-data`; build the renderer in `@contentgrid/ui`.
3. Phase 5D.7: port any field types not covered by Phase 5A (date-time, multi-select, nested object viewer).
4. Cutover: the new app is the only consumer of the new renderer; the existing navigator continues to use JSON Forms unchanged until decommissioned. No dual-rendering layer.

### Open risk that survives the analysis

If a customer's HAL-Forms `_templates` evolves post-cutover and introduces a shape the renderer's discriminated union doesn't cover, the failure mode is a TypeScript compile error in the renderer (visible) rather than a silent fallback (invisible). This is desirable — but the renderer needs an explicit "unhandled descriptor type" path that fails loudly in dev and renders a marker in production, so the gap is caught early. Tracked under Phase 5A as a renderer-design requirement.

---

## 4. AI-driven development — concrete setup

For the goal "scaffold a new UI quickly with AI using the component library":

1. **Per-package CLAUDE.md** in `packages/ui`, `packages/navigator-data`, `apps/navigator` with:
   - Naming conventions (component file == default export name, `kebab-case` files, `PascalCase` exports)
   - "When asked to add a primitive, run `pnpm --filter @contentgrid/ui shadcn add <name>` and re-export from `index.ts`"
   - "When asked to add a ContentGrid pattern, run `pnpm shadcn add @contentgrid/<name>` (uses the ContentGrid registry — see ADR-012)"
   - "Patterns are composed only from primitives; never use `radix-ui` directly outside `packages/ui`"

2. **No custom CLI wrapper** (ADR-012). The shadcn CLI is used as-is; conventions are enforced by lint, code review, and `CLAUDE.md` — not by intercepting `shadcn add`. A `package.json` recipe (`"ui:add": "shadcn add $1 && pnpm gen:story $1"`) is allowed if a deterministic post-step proves repetitive. A wrapper CLI is not.

3. **Storybook stories as AI ground truth** — every component must have a `*.stories.tsx`. Agents read stories to learn API + variants without parsing implementation. Enforce via lint rule (`eslint-plugin-storybook` + a custom rule that flags exports without an adjacent story).

4. **Visual regression via Playwright story snapshots on every PR** (ADR-009) — closes the "AI wrote the code, did it actually render correctly?" loop. Self-hosted, baselines committed to git, no Chromatic spend. Same agent-feedback loop as a hosted tool.

5. **`/ultrareview` and `everything-claude-code:tdd-workflow`** are already available — wire them into pre-commit.

> Custom-track scaffolding (per-customer `apps/<customer>/` generation from `packages/ui` + `packages/features/*`) is deferred to first-customer trigger per ADR-010. The originally-proposed `/scaffold-ui` Claude skill is dropped from team scope.

### 4A. Onboarding additional engineers to the agentic workflow

Premchitra is available full-time from the Xenit side and will join as primary executor for in-flight navigator migration tickets, working in the agentic loop alongside Nick.

**Tooling setup:** Claude Code access (Pro or Max licence as appropriate), monorepo clone, IDE with the relevant extensions. Reading order before taking the first ticket: per-package `CLAUDE.md` files → ADR index → this analysis → the roadmap.

**First week:** pair on a single feature port end-to-end — one of the Phase 5D easy gaps (e.g. 5D.1 continuous-create mode or 5D.2 cross-tab sign-out). Observe the full loop: read story → write component → run snapshot test → review. Nick reviews the first two PRs together with Premchitra before Premchitra runs the loop solo.

**Operating model:** tickets live in the same Jira project as the existing Xenit sprint flow. Premchitra picks up tickets assigned in sprint planning; agent-assisted implementation; PR review by Nick + a Xenit reviewer (Lars or Thijs depending on area).

**Promote/demote rule:** if the agentic loop produces too much rework on a given ticket type, drop back to traditional development for that ticket. Capture the failure mode in the relevant `CLAUDE.md` as a "do not agent" note. This is not a failure — it's calibration data.

Onboarding task tracked in Phase 1 of the roadmap (task 1.12): "Onboard Premchitra — tooling + first paired feature port + CLAUDE.md walk-through." Estimate: ~0.5d Nick, ~1.5d Premchitra.

---

## 4B. Collaboration model with Xenit team

Navigator migration tickets land in the **same Jira project as the existing Xenit sprint flow**. Confirm project key and ticket labelling convention with Thijs before 21 May (next sprint planning, moved due to Ascension + collective day off).

**Per-sprint cadence:**
- Nick prepares the next sprint's navigator tickets at least 2 working days before sprint planning.
- Tickets reviewed at the existing sprint planning meeting; Xenit team flags conflicts with prior work or known issues.
- Premchitra is primary executor for in-flight tickets; see section 4A for agentic operating model.

**Technical decisions:**
- Captured as ADRs in `docs/adr/`. Nick owns ADR drafts; Xenit team (Lars, Thijs, Ronny) review before merge. Decisions are not considered settled until the ADR is merged.

**Standup and escalation:**
- Align with the existing Xenit standup. Escalation path: Thijs first, then Ronny.

**Action:** Nick to confirm sprint cadence and Jira labelling convention with Thijs before 21 May.

---

## 5. Test coverage strategy (since both are at ~0%)

Neither codebase has meaningful tests. Don't try to back-fill the original — write tests for the new app from the start.

**Pyramid:**

| Layer                    | Tool                           | Target                                                    | Notes                                                        |
| ------------------------ | ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------ |
| Unit (pure logic)        | **Vitest**                     | 80%                                                       | URL encoders, accessors, schema converters, Zustand reducers |
| Component                | **Vitest + Testing Library**   | Every primitive + pattern via Storybook `@storybook/test` | Stories ARE tests with `play()`                              |
| Integration (hook + MSW) | Vitest + **MSW**               | All TanStack Query hooks                                  | Mock HAL responses                                           |
| E2E                      | **Playwright** (already there) | Critical journeys × {Chromium, Firefox, WebKit} × {desktop, mobile}; PRs run Chromium-only, full matrix nightly + on main | Inherit the original's spec, expand                          |
| Visual                   | **Playwright**                 | All stories                                               | Auto-baseline, agent-friendly                                |

**Target: 80% line + 100% of critical user journeys via Playwright.** Use `@vitest/coverage-v8` with thresholds enforced in CI.

WebKit coverage matters specifically for PDF/extraction work (Phase 6) — canvas coordinate and rendering code can diverge between engines.

### 5A. Cross-repo integration testing gap

Cross-service integration testing is a known production pain point. A backend change (e.g. an Architect / management-platform update) can break navigator features — attribute editing, relation rendering — without any navigator code changing and without any navigator test failing. Thijs raised a concrete example from production: an Architect update broke the console's attribute editing silently.

The navigator's Playwright tests run navigator-internal flows and do not catch breaking changes in upstream `@contentgrid/*` peer dependencies or in the platform itself.

Mitigation options:

- **(a)** Publish the navigator's Playwright suite as a runnable artefact other CI pipelines can consume against a deployed navigator instance.
- **(b)** Add contract tests at the HAL boundary using MSW fixtures from production — catch shape changes before they reach the running app. Fixtures already exist for entity profile audit (Phase 0.5); reuse as a contract test layer.
- **(c)** Leave cross-repo integration testing explicitly out of scope for the cutover and track as a separate initiative.

**Recommendation: (b) as a Phase 2 addition.** MSW fixtures are already being written for Phase 2 (task 2.4); extending them to cover contract assertions at the HAL response boundary adds minimal overhead and catches the class of breakage Thijs described. Options (a) and (c) remain open; decide after Phase 2 demonstrates whether (b) alone is sufficient coverage. See ADR-014 for the full decision rationale.

---

## 6. Build plan — cutover-first scope (see roadmap for tasks and estimates)

The roadmap defines **11 phases (0–10)** but commits only to the **cutover-first scope**: Phases 0, 0.5, 1–7, and 10. **Phase 8** (custom-track scaffolding) and **Phase 9** (Apache-2.0 OSS release) are deferred to post-cutover with explicit triggers (ADR-010), as is the `@contentgrid/navigator-data` publish ceremony (originally tasks 4.8–4.10).

Cutover-first scope total: **64 optimistic / 81.5 realistic / 99 pessimistic net engineer-days**, calendar estimates ~14 weeks (single engineer), ~10 weeks (two engineers), or ~7 weeks (three engineers). The +1.5d increase vs. the original 79d realistic estimate reflects three post-initial-plan task additions: 1.12 (Premchitra onboarding), 2.6 (HAL contract tests, ADR-014), and 6A.5 (video preview port). Phase titles and one-line scope (full task breakdowns and sprint plans in `contentgrid-navigator-migration-roadmap.md`):

| Phase | Title | Scope | Status |
|---|---|---|---|
| 0 | Alignment & decisions | ADRs 001–015 captured; outstanding: extraction LLM strategy (Phase 0.6) | ✅ in scope |
| 0.5 | Production entity-profile audit | HAL-Forms `_templates` shapes + JSONForms-only behaviours catalogued as fixtures | ✅ in scope |
| 1 | Monorepo + tooling foundation | pnpm workspaces, generic + experimental app shells, ESLint stability-flag enforcement, CI two deploy lanes, Playwright story snapshots | ✅ in scope |
| 2 | Test scaffolding | Vitest, MSW, coverage thresholds, Playwright config ported | ✅ in scope |
| 3 | Component library hardening | Stories + play-fn tests for all shadcn primitives and patterns; design tokens; a11y audit | ✅ in scope |
| 4 | `@contentgrid/navigator-data` extraction | Move hooks/auth/config to workspace package; MSW integration tests; publish-ready surface (publish ceremony deferred) | ✅ in scope |
| 5 | Feature parity & correctness | 5A HAL-Forms bridge + renderers; 5B ETag concurrency; 5C search/list parity; 5D easy original gaps | ✅ in scope |
| 6 | PDF preview & AI extraction | 6A PDF viewer toolbar parity (with ADR-011 fallback); 6B extraction flow port (highest-risk — see spike 6B.1) | ✅ in scope |
| 7 | Production hardening | Error boundaries, i18n, RBAC-aware rendering, a11y CI, security review, Docker/deploy | ✅ in scope |
| 8 | Custom track scaffolding | Customer-app template, `customer.config.ts` schema (Claude skill dropped) | ⏸ deferred — first-customer trigger |
| 9 | Apache-2.0 OSS release | Repo hygiene, secrets scan, CI/release pipeline, docs site | ⏸ deferred — post-cutover re-plan |
| 10 | Cutover | Staging side-by-side, beta-tester pass, production cutover, original repo archived | ✅ in scope |

For per-phase task breakdowns, effort by task, sprint plans (single / two / three engineer), and dependency graph see `contentgrid-navigator-migration-roadmap.md` (filename preserved). For decision rationale see `adr/README.md`.

---

## 6A. Documentation strategy

Three documentation surfaces currently exist for ContentGrid navigator work:

| Surface | Audience | Owns |
|---|---|---|
| Obsidian (author's PARA vault) | Author | Current home for in-flight planning docs (analysis, roadmap, ADR set) until Phase 1; migration trigger is Phase 1 monorepo bootstrap |
| In-repo `docs/` (ADRs, this analysis, roadmap) | Developers, architects | Architecture decisions, version-controlled with code (post-Phase 1 destination) |
| Public docs site | End users | How to use the navigator (how-to guides, config reference) |
| Confluence | Operators, internal team | Operational runbooks, deployment ops, internal notes |

**Proposed split during the cutover scope:**
- Architecture decisions, ADRs, this analysis, and the roadmap → in-repo `docs/` (closest to code, versioned with changes, reviewable in PRs). Until Phase 1: these live in the Obsidian vault as in-flight planning docs and migrate to the repo during Phase 1.1 (monorepo bootstrap).
- User-facing UI documentation (how to use the navigator) → public docs site, deferred to Phase 9D.
- Operational runbooks, deployment ops → Confluence (existing convention, internal).

**Open question:** navigator-specific design documentation currently in Confluence — to be reviewed and migrated where appropriate. Thijs flagged this in the 2026-05-08 meeting ("we have documentation on Confluence, we have some website, we have some design documentation — I think we need to review clearly what goes where"). A dedicated meeting was planned.

**Action:** Nick + Thijs to align on the doc-split convention before Phase 1 starts, specifically to review Confluence design documentation for migration to in-repo `docs/`. See ADR-015 for the adopted split and open action.

---

## 7. Risks to flag

1. **PDF byte-range / progressive streaming scope creep.** Stakeholders who see "PDF preview" in Phase 6A may assume progressive byte-range streaming is included. It is not — it requires a BFF + session-cookie auth change that is a separate initiative. Make this explicit at Phase 6A kickoff. See section 1 for the full technical distinction.
2. **Extraction flow has no spec.** The original has it implemented but untested. Phase 6B.1 is a dedicated spike to produce a written behaviour spec + sequence diagrams before any porting begins — this is the primary mitigation. Without it you're porting bugs.
3. **JSONForms divergence.** Anywhere the original used a JSONForms feature not yet implemented in the new app (oneOf/anyOf, conditional fields, custom validation), users may notice. Audit forms in the original by enumerating all entity profile schemas in production and confirming every shape renders correctly in the new app.
4. **Pinned `pdfjs-dist@3.3.122` in original vs `@embedpdf/react-pdf-viewer` in prototype** — different rendering, possibly different annotation coordinate systems. Extraction port must reconcile (Phase 6B.2).
5. **No CI in either repo.** Cutover with no CI is reckless. Phase 2 is non-negotiable.
6. **Stability-flag bypass** — experimental features inadvertently imported into the generic build. Mitigated by the ESLint rule blocking non-stable imports (Phase 1.9) and a CI bundle audit that fails the build if experimental features appear in the generic bundle.
7. **ETag/optimistic-concurrency regression** — the prototype's update/delete paths currently lack `If-Match` headers. Phase 5B explicitly ports the production ETag policy and adds integration tests covering the 412 Precondition Failed path.
8. **Secrets in git history blocking OSS publish** — `VITE_DEV_TOKEN` or any `.env.local` committed at any point would block an Apache-2.0 release. Phase 9B runs `gitleaks` + `trufflehog` over full history; mitigation is credential rotation + history rewrite, or publishing from a fresh-history fork.

---

## Appendix A — Original codebase characterization

Medium-sized (159 TypeScript source files, ~6,000–8,000 effective lines of logic), product-quality but early-stage (v0.1.0) SPA built on React 19 / Vite 8 / TanStack Query v5 with strong TypeScript discipline. Architecture is clean and domain-driven, with a well-thought-out HAL/HAL-FORMS abstraction layer that makes the UI almost entirely data-driven from the API schema. Primary porting difficulty is the tight, pervasive dependency on the proprietary `@contentgrid/*` library suite — retained as-is in the prototype. Secondary risks: the untested, complex `useEntityInstanceState` state machine and the PDF-annotation/extraction interaction.

## Appendix B — Prototype characterization (architectural reference)

Substantially beyond a scaffold — a functioning navigator with real HAL/ContentGrid API integration, full entity CRUD, demo-only multi-dashboard and AI-chat surfaces (scoped out of production per roadmap), settings management, polished shadcn/Tailwind v4 UI. Core interaction loops (browse, create, edit, delete, relate, search, dashboard) all working. Remains a prototype in the testing dimension (0% coverage, no framework), no i18n, no RBAC-aware rendering, no error/404 boundary at the router level, no CI, no formatter discipline. The prototype reflects **~55–65% of what a hardened production navigator needs** — visible feature surface ~80% prototyped and liftable as starting code, but invisible production concerns (tests, CI, a11y, i18n, permissions) account for the remaining gap. The new app must close the production-readiness gap regardless.

## Appendix D — Team-reported pain points

*Opened by Ranec on 2026-05-08. Xenit team members can append current frustrations or pain points with the existing navigator directly in this section, or file them as Jira tickets with a `nav-pain` label.*

*Format per entry: short description | raised by | date. Nick triages weekly — items become roadmap scope additions, risk register entries, or explicit out-of-scope calls.*

*(No entries yet — add yours below.)*

---

## Appendix C — Shared `@contentgrid/*` dependencies (do not reimplement)

- `@contentgrid/hal` — HAL object/link/slice model
- `@contentgrid/hal-forms` — HAL-FORMS template resolution, codecs, value objects, builder
- `@contentgrid/typed-fetch` — typed request/response wrappers
- `@contentgrid/fetch-hooks` — composable fetch middleware
- `@contentgrid/fetch-hook-authentication` — OIDC token injection
- `@contentgrid/problem-details` — RFC 7807 error handling
- `@contentgrid/uri-template` — URI template expansion

---

**Hub:** [[00-ContentGrid-MOC]]
