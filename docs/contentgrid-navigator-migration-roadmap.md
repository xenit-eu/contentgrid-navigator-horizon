# ContentGrid Navigator — Front-End Build Roadmap

**Date:** 2026-04-27 (revised 2026-04-29 — cutover-first scope, ADRs extracted; prepared for Xenit review 2026-05-06) (2026-05-07: reframed — the new front-end layer is the deliverable, not the prototype)
**Owner:** Nick Van Vynckt
**Companion doc:** `contentgrid-navigator-migration-analysis.md`
**ADR index:** `adr/README.md` — ADRs 001–015 capture the decisions referenced throughout this roadmap
**Estimation basis:** AI-driven implementation (Claude Code / agents writing the bulk of code; human in review + decision loop). See *Estimation notes* at end.

---

## Estimation notes (read first)

Estimates are in **engineer-days** (1 day = ~6 productive hours). They assume:

- **Implementation, scaffolding, tests, docs** are agent-driven (Sonnet/Haiku via Claude Code, with Opus for planning).
- **Human time** is review, integration debugging, decisions, customer/stakeholder alignment.
- Speedup vs. human-only baseline (calibrated, not assumed): **~2–3× for mechanical work**, **~1.3–1.8× for novel/integration work**, **~1× for human-in-the-loop decisions**. The blended multiplier across phases 4–7 (mostly integration/correctness work) is ~1.5–2×, not 3×. Earlier drafts used 3–5× as a planning basis; that was optimistic and has been re-calibrated.
- Each estimate has a **confidence** rating (H/M/L). Low-confidence items should be re-estimated after a spike.
- Estimates exclude meetings, context switches, and the cost of deciding *what* to build — only execution.
- A single engineer + agents executes one phase at a time. Parallelisation possible from Phase 3 onward if a second engineer joins.

**Total estimate for cutover-first scope (net engineer-days):** **64 optimistic / 81.5 realistic / 99 pessimistic** (Phase 6 doubling). Reflects re-calibrated AI multiplier, integrated correctness work (HAL-Forms, ETag), three-track delivery model (generic + experimental shells now; custom track scaffolding deferred), `@contentgrid/navigator-data` as a workspace package (publish ceremony deferred), entity-profile audit, no Chromatic spend. Phase 1 includes ~0.5d additional overhead for fresh-monorepo bootstrap vs. in-place conversion; absorbed within the existing buffer. +1.5d vs. original 79d realistic estimate due to three task additions: 1.12 (Premchitra onboarding), 2.6 (HAL contract tests), 6A.5 (video preview port).

**Deferred to post-cutover:**
- **Phase 8 — Custom track scaffolding** (~2.5d, drops the `/scaffold-ui` Claude skill). Triggered when the first new customer customisation is committed. Existing customer UI stays on its current build until naturally revisited.
- **Phase 9 — Apache-2.0 OSS release** (~6d). Strategic intent confirmed; sequencing pushed past production cutover so we don't fight on three fronts at once. Re-plan after Phase 10.
- **`@contentgrid/navigator-data` publish pipeline** (~1.5d, originally 4.8–4.10). Consumed via workspace protocol until an out-of-tree consumer (custom-track customer app, ContentGrid console, or OSS release) creates the actual need.

Calendar runthrough depends on engineer count, parallelisation, review cadence, and Xenit coordination latency; see Roll-up and Dependencies sections.

---

## Three-track delivery model

The modernised navigator ships in **three coordinated tracks**, all out of one monorepo:

| Track | App path | URL | Purpose | Stability |
|---|---|---|---|---|
| **Generic** | `apps/navigator` | production domain | Robust default UI that adjusts to any ContentGrid content model. Drives the OSS release. | only `stable` features |
| **Experimental** | `apps/navigator-experimental` | separate domain (e.g. `*-experimental.*`) | Customer demos, in-flight ideas, anything not yet promoted. Never bundled into generic. | imports `stable` + `candidate` + `experimental` |
| **Custom** | `apps/<customer>/` | per-customer | Bespoke front-ends scaffolded from `packages/ui` + `packages/data` via Phase 8. | declared per-app |

### How features move between tracks

Features live in `packages/features/<name>/` with a stability flag in their `package.json`:

```
experimental → candidate → stable
```

- **Generic** imports only `stable`-flagged features (enforced via lint rule).
- **Experimental** imports all flags.
- **Custom apps** declare their own feature set per `customer.config.ts`.
- **Promotion = flipping the flag + adding to generic's allowlist.** No code move, no fork drift.

### Why this shape

- Demos run on a separate URL so prospects never see half-built UX as production.
- Promotion path is a code review, not a port — features written in experimental are usable in generic the next day if they pass review.
- One CI pipeline, two deploy lanes. No duplicate maintenance of pattern code.
- Custom-track scaffolding (Phase 8) consumes the same `packages/*`, so customers benefit from generic improvements automatically.

### What this is **not**

- Not a feature-flag-in-prod pattern (no env-toggled experimental code in the generic build).
- Not a long-lived branch model (everything is on `main`; gating is at the package layer).
- Not a fork — experimental and generic share every line of code in `packages/`.

---

## HAL adapter — two-layer dependency model

Backend-coupled code is already partly external (Xenit publishes seven `@contentgrid/*` packages). We add **one navigator-side adapter package** on top, so that any change in the backend HAL contract or the navigator's data conventions propagates by version bump, not by editing every consumer.

### The two layers

**Layer 1 — Xenit-owned (already published, 0.4.x today)**

| Package | Scope |
|---|---|
| `@contentgrid/hal` | HAL data model: `HalObject`, `HalSlice`, `Link`, `SimpleLink` |
| `@contentgrid/hal-forms` | HAL-Forms `_templates` parsing: `HalFormsTemplate`, `HalFormsProperty`, `resolveTemplate` |
| `@contentgrid/typed-fetch` | Typed fetch: `createTypedFetch`, `TypedRequest`, `TypedRequestSpec` |
| `@contentgrid/fetch-hooks` | Middleware composition |
| `@contentgrid/fetch-hook-authentication` | OIDC token exchange middleware |
| `@contentgrid/problem-details` | RFC 7807 problem details |
| `@contentgrid/uri-template` | RFC 6570 URI templates |

Xenit owns the release cadence here. Backend HAL contract changes ship via a Xenit bump; we track and consume via peerDep ranges.

**Layer 2 — composition layer (new, Apache-2.0)**

```
Xenit @contentgrid/* (×7, peerDeps)
       └── @contentgrid/navigator-data    (new — navigator-side composition)
             ├── apps/navigator           (generic)
             ├── apps/navigator-experimental
             └── apps/<customer>/         (custom track)
```

`@contentgrid/navigator-data` contains **only** what's not already in a Xenit package:

- Composition glue: typed-fetch + auth hooks + problem-details wired into a usable client
- TanStack Query hooks: `useEntity`, `useList`, `useCreate`, `useUpdate`, `useDelete`, `useRelation`, `useSearch`
- ETag / `If-Match` optimistic concurrency policy
- HAL-Forms → `FieldDescriptor[]` bridge — small mapper that consumes `@contentgrid/hal-forms` output and emits a shadcn-renderer-friendly shape (Phase 5A)
- Zod-validated app config + presets
- MSW handler fixtures for tests (consumer-friendly)

It does **not** re-implement HAL parsing, HAL-Forms parsing, fetch composition, or auth — those are peerDeps to Xenit packages.

### Release model

**Phase 4 (now):** workspace package, no publish ceremony.
- **Repo location**: `packages/navigator-data/` in the navigator monorepo.
- **Consumed via**: pnpm `workspace:*` protocol from `apps/navigator` and `apps/navigator-experimental`.
- **Why workspace-only for now**: with no out-of-tree consumer yet, semver/changesets/registry overhead pays no return. The package boundary still gets us module discipline, tree-shaking, and a clean test surface — without the ceremony.

**Trigger to start publishing (deferred from original Phase 4):**
- First custom-track customer app moves out of the monorepo, **or**
- The ContentGrid console adopts it, **or**
- We decide to ship the OSS release (Phase 9) — the package needs to be publicly installable then.

**When triggered**, add: semver via changesets, `npm publish` (or ghcr-npm) on tag `navigator-data-vX.Y.Z`, CHANGELOG, peerDep compat matrix vs. Xenit `@contentgrid/*`, and a CI check that all consuming apps pin a compatible range. Estimated ~1.5d when needed; tracked separately from the Phase 4 estimate.

**Backend coupling:** when Xenit bumps any layer-1 package, we update the workspace `peerDependencies` range. Compat matrix becomes a real artefact only at publish time.

### Why two layers (vs. one big composition adapter)

If we re-vendored or re-implemented anything from layer 1, we'd own a fork. Instead we **peerDep upward** so Xenit remains the source of truth for backend coupling.

### Why externalise at all (vs. internal workspace)

| Choice | Pro | Con |
|---|---|---|
| **Externalised + published (chosen)** | One bump propagates to all three tracks + customer apps; reusable in non-navigator front-ends; OSS-publishable | Release ceremony (changesets, semver, CHANGELOG); version-skew risk between consumers |
| Internal workspace only | Zero ceremony, atomic changes | No reuse outside navigator repo; future custom apps drift |

Re-evaluate at end of Phase 4. If layer-1 packages turn out to evolve quickly enough that we constantly chase Xenit, we may collapse the layer-2 package back into the monorepo.

### What stays in the monorepo

- `packages/ui` — primitives + patterns (presentation only, no HAL knowledge)
- `packages/features/*` — feature modules (consume `@contentgrid/navigator-data`)
- `apps/*` — the three tracks

---

## Phase 0 — Alignment & decisions (2 days, **H**)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 0.1 | Stakeholder kickoff: confirm scope, success criteria, freeze date | 0.5d | H |
| 0.2 | Decide: Storybook 9 vs. Ladle (recommend Storybook + Chromatic) | 0.25d | H |
| 0.3 | **ADR: Monorepo tooling: pnpm workspaces; Nx rejected; Turborepo deferred** — pnpm workspaces only; Nx adds project-graph/executor overhead without payoff at this scale and hurts OSS release; Turborepo deferred until CI no-op PRs exceed ~5 min. **ADR also records pnpm/Yarn parity on vulnerability patching:** `pnpm.overrides` replaces Yarn `resolutions` (same selector grammar, audit-aware); `pnpm patch` / `pnpm patch-commit` adds a checked-in patch capability Yarn 1 lacks. No regression vs the existing navigator's transitive-vuln workflow. | 0.25d | H |
| 0.4 | **ADR: Drop JsonForms, build shadcn-native HAL-Forms renderer** — significant architectural commitment | 0.25d | H |
| 0.5 | **Decide: Xenit OSS repo + registry target** — confirm with Xenit which repo and registry to publish under (e.g. `github.com/xenit-eu/contentgrid-navigator`, `ghcr.io/xenit-eu/...`). Drives CI image-push targets when Phase 9 lights up | 0.25d | M |
| 0.6 | **Decide: extraction LLM provider strategy** — which providers (Anthropic / OpenAI / Gemini) the backend extract-service supports; client-side selector UI scope (Phase 6B.7) | 0.25d | M |
| 0.7 | **ADR: Three-track delivery model** — generic / experimental / custom; portability via stability-flagged `packages/features/*`; separate experimental URL; promotion workflow | 0.25d | H |
| 0.8 | **ADR: Two-layer dependency model** — existing `@contentgrid/*` (×7) as peerDeps; new `@contentgrid/navigator-data` composition layer (hooks, ETag, HAL-Forms→shadcn bridge, config). Apache-2.0, semver, independent release. Confirm namespace + registry with Xenit | 0.25d | M |

**Exit criteria:** signed-off architecture decisions, written ADRs in `docs/adr/` for each decision above.

---

## Phase 0.5 — Production entity-profile audit (1.5 days, M)

HAL-Forms parity (Phase 5A) and JSONForms field-type audit (5D.7) both depend on having the full set of production entity profile schemas in hand. Doing this audit early de-risks two later phases and produces fixtures the test suite reuses.

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 0.5.1 | Pull anonymised entity profile JSON dump from production (request via Xenit) | 0.25d | M |
| 0.5.2 | Enumerate all `_templates` shapes used in production: types, ranges, enums, relations, conditionals | 0.5d | M |
| 0.5.3 | Catalogue any JSONForms-only field behaviours (oneOf/anyOf, conditional rendering, custom validation) that need shadcn equivalents | 0.5d | M |
| 0.5.4 | Convert findings into Phase 5A fixtures (round-trip parity inputs) and a Phase 5D.7 work-item list | 0.25d | H |

**Exit criteria:** fixture set committed to `packages/navigator-data/test-fixtures/`; Phase 5D.7 either confirmed in scope as-is or re-estimated.

---

## Phase 1 — Monorepo + tooling foundation (7 days, **H**)

This phase establishes the **three-track topology** in code: generic + experimental app shells today; the custom-app template lands in Phase 8.

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 1.1 | Initialise the new monorepo with pnpm workspaces; create `apps/navigator` (generic), `apps/navigator-experimental`, `packages/ui`, `packages/navigator-data` (publish-ready), `packages/features`, `packages/eslint-config`, `packages/tsconfig` | 1.25d | H |
| 1.2 | Lift shadcn primitives from the prototype into `packages/ui/src/primitives/` | 0.5d | H |
| 1.3 | Extract Tailwind v4 preset to `packages/ui/tailwind-preset.ts`; share across both apps | 0.25d | H |
| 1.4 | Set up Storybook 9 (Vite builder, Tailwind v4, dark mode addon) in `apps/storybook` — render features from both stability tiers | 0.5d | M |
| 1.5 | Playwright snapshot tests against Storybook stories (self-hosted visual regression; baselines committed under `tests/__snapshots__/`). Replaces Chromatic — same loop, no external service cost | 0.5d | M |
| 1.6 | GitHub Actions CI with **two deploy lanes**: lint/typecheck/test/build for both apps; Playwright story snapshots; deploy generic → prod-domain, experimental → experimental-domain | 0.75d | H |
| 1.7 | Prettier + import sort + lint-staged + husky pre-commit | 0.25d | H |
| 1.8 | Per-package `CLAUDE.md` with conventions, three-track promotion rules, and shadcn-CLI usage (`pnpm shadcn add` direct — no wrapper, ADR-012) | 0.25d | H |
| 1.9 | **Stability-flag enforcement**: `packages/features/<name>/package.json` carries `"x-stability": "experimental" \| "candidate" \| "stable"`. ESLint rule blocks generic from importing non-stable features. Promotion = PR flipping the flag | 1.25d | M |
| 1.10 | Seed `packages/features/` with one `stable` feature (e.g. entity-list) and one `experimental` placeholder; verify generic build excludes the experimental one | 0.5d | M |
| 1.11 | Branding/domain split: `apps/navigator-experimental` shows a clear "experimental — not for production use" banner; separate favicon | 0.5d | H |
| 1.12 | **Onboard Premchitra** — Claude Code access + repo clone; reading order walk-through (per-package `CLAUDE.md` → ADRs → analysis → roadmap); pair on one Phase 5D easy gap end-to-end; establish PR review flow (Nick + Lars or Thijs as Xenit reviewer) | Nick: 0.5d, Premchitra: 1.5d | H |

**Exit criteria:** green CI on a no-op PR for both apps; `pnpm storybook` renders all 25 shadcn primitives; Playwright snapshot baseline committed; generic app build provably excludes experimental features (lint + bundle audit); experimental app deploys to its own URL.

---

## Phase 2 — Test scaffolding (2.5 days, **H**)

| #   | Task                                                                                                            | Estimate | Confidence |
| --- | --------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 2.1 | Install Vitest + Testing Library + `@vitest/coverage-v8` + MSW                                                  | 0.25d    | H          |
| 2.2 | Configure coverage thresholds (start 40%, ratchet up) and Codecov                                               | 0.25d    | H          |
| 2.3 | Write first 20 unit tests (Zustand reducers, URL encoders, schema converters, config validation) — agent-driven | 0.75d    | H          |
| 2.4 | MSW handler stubs for `@contentgrid/*` HAL responses (reusable across all data tests)                           | 0.5d     | M          |
| 2.5 | Adopt Playwright config from original repo into `apps/navigator/tests/`                                         | 0.25d    | H          |
| 2.6 | **Contract test layer at the HAL boundary** — extend MSW fixtures from 2.4 to assert response shapes; catches breaking changes in upstream `@contentgrid/*` packages or platform before they reach the running app. Addresses the cross-repo integration testing gap (Thijs: "we still experience that we ship some broken combinations to production"). Reuse entity-profile fixtures from Phase 0.5. | 0.5d | M |

**Exit criteria:** `pnpm test` and `pnpm test:e2e` green; coverage report published in CI; HAL contract test layer catches at least one simulated upstream shape change.

---

## Phase 3 — Component library hardening (5 days, **H**)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 3.1 | Story + play-fn test for each of the 25 shadcn primitives — agent-driven, batched | 1.5d | H |
| 3.2 | Extract design tokens (colours, spacing, radii, type) to `packages/ui/tokens/` with CSS vars | 0.5d | H |
| 3.3 | Build "patterns" layer: `EntityCard`, `DataTable`, `FilterSidebar`, `RelationSection`, `EntityPicker`, `FileUploadZone`, `BrandingHeader` — extracted from `apps/navigator` | 1.5d | M |
| 3.4 | Stories + play tests for each pattern | 0.75d | H |
| 3.5 | A11y audit per primitive (axe-core in stories) — fix violations | 0.5d | M |
| 3.6 | `@contentgrid/ui` consumed via `pnpm workspace:*` for the cutover scope. Add a `registry.json` stub for the ContentGrid shadcn registry (ADR-012) so `shadcn add @contentgrid/<pattern>` works in-monorepo today and externally when published. Publish ceremony deferred per ADR-008 | 0.25d | H |

**Exit criteria:** Storybook covers 100% of `packages/ui` exports — every primitive and pattern has a story plus a `play()` test; Playwright story snapshots green with intentional diffs reviewed; axe-core violations zero; coverage on `packages/ui` ≥ 85%.

**Note on visual regression:** Chromatic is intentionally not used (cost). The substitute is Playwright snapshot tests against Storybook (1.5), reviewed in PR like any other diff. The "agent visual feedback loop" works identically — agents read the snapshot diff in CI; it just isn't hosted by a third party.

---

## Phase 4 — `@contentgrid/navigator-data` extraction (4 days, **H**)

Promotes the data/auth/config layer to a **workspace package** that the generic and experimental apps consume via `workspace:*`. Publish ceremony is deferred — see *HAL adapter — Release model* for triggers.

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 4.1 | Lift `src/lib/api/*` from the prototype into `packages/navigator-data/src/api/` as starting point (HAL client, fetch composition) | 0.5d | H |
| 4.2 | Lift `src/lib/hooks/*` from the prototype into `packages/navigator-data/src/hooks/` as starting point (TanStack Query hooks, 15+ files) | 0.5d | H |
| 4.3 | Lift `src/lib/auth/*` from the prototype into `packages/navigator-data/src/auth/` as starting point (OIDC + dev-token bypass) | 0.5d | H |
| 4.4 | Lift `src/lib/config/*` from the prototype into `packages/navigator-data/src/config/` as starting point (Zod-validated config, presets) | 0.25d | H |
| 4.5 | MSW-backed integration tests for every hook (use, list, create, update, delete, relation, search); export reusable handler fixtures for consumers | 1.5d | M |
| 4.6 | Re-export surface design + barrel files; ensure tree-shaking; declare all 7 Xenit `@contentgrid/*` packages as `peerDependencies` (not direct deps) so the publish path stays open | 0.25d | H |
| 4.7 | Smoke test: both apps boot and work via the workspace package | 0.5d | M |

**Deferred to publish trigger (~1.5d when needed):** publish pipeline to npm/ghcr-npm with changesets and CHANGELOG; written compat matrix vs. Xenit `@contentgrid/*` versions; CI check enforcing version-pin discipline across consumers. Out of scope until first out-of-tree consumer (custom-track customer app or OSS release).

**Exit criteria:** `apps/navigator` and `apps/navigator-experimental` import nothing from `src/lib/`; package builds, tests pass via workspace protocol; coverage ≥ 80%; peerDep declaration is publish-ready (so the deferred publish step is mechanical when triggered).

---

## Phase 5 — Feature parity & correctness (11 days, **M**)

Each task is **tests-first**: write the failing Playwright/unit test, then implement.

This phase now includes **correctness bugs** — areas where the existing navigator and server contract reveal gaps that the new app must close. These are not nice-to-haves; they are blockers for any customer-facing deploy.

### 5A. HAL-Forms integration & forms correctness (~3.75 days)

The single biggest correctness gap. The prototype's `useFormFields` (the starting-point code for the new app) ignores `_templates` entirely and drives forms from profile metadata — server-controlled form semantics are silently lost. The new app must implement this correctly.

**Scope correction vs. earlier draft:** the heavy lifting (parsing `_templates` → `HalFormsTemplate` / `HalFormsProperty`) is already done by Xenit's `@contentgrid/hal-forms` (`resolveTemplate`). The work here is a **bridge mapper** that adapts that output to a shadcn-renderer-friendly `FieldDescriptor[]`, plus the renderer set itself. Not a 500-LOC port.

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 5A.1 | Bridge `@contentgrid/hal-forms.HalFormsTemplate` → `FieldDescriptor[]` in `packages/navigator-data/src/schema/`. Handles type mapping, range-pair pairing, options/enum, relation-link references | 0.75d | M |
| 5A.2 | Replace `useFormFields` to consume `_templates.create-form` / `default-form` via the bridge | 0.5d | H |
| 5A.3 | shadcn-native field renderers: typeahead (prefix-match), enum (single + multi), datetime, **range date pair**, file, relation (to-one + to-many) | 1.5d | M |
| 5A.4 | Unsaved-changes route guard on dirty form (TanStack Router `beforeLoad`/`onLeave`) | 0.25d | H |
| 5A.5 | Relation accordion + unlink-all flow | 0.5d | H |
| 5A.6 | Round-trip parity test: existing navigator's `_templates` for a known entity renders identically in the new app, consuming Phase 0.5 fixtures | 0.25d | M |

**Exit criterion (5A):** known-entity HAL-Forms `_templates` round-trip identically against the existing navigator's reference output.

### 5B. Concurrency & data correctness (~1 day)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 5B.1 | ETag / `If-Match` on update + delete paths — audit `use-update-entity.ts`, port optimistic concurrency from production | 0.5d | H |
| 5B.2 | Error toasts via `sonner` for 412 Precondition Failed (replace ad-hoc alerts) | 0.25d | H |
| 5B.3 | `@contentgrid/*` version pin alignment (prototype on 0.4.2 vs. existing on 0.4.1) — verify no regressions | 0.25d | M |

### 5C. Search & list parity (~2 days)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 5C.1 | Range-pair operators in filter sidebar (`~from` / `~until` / `~gte` / `~lte`) — beyond generic range fields | 0.75d | M |
| 5C.2 | Typeahead prefix-match on text fields, debounced (port `TypeAheadContext`) | 0.5d | M |
| 5C.3 | Filter chips with dismiss UX matching production | 0.25d | H |
| 5C.4 | Profile selector for multi-profile ContentGrid apps (port `ProfileSelector`) | 0.25d | H |
| 5C.5 | Server-side saved searches (currently localStorage only) — optional, confirm requirement | 0.25d | L |

### 5D. Original easy gaps (~4 days)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 5D.1 | Continuous-create mode (form stays open after save, focus returned, success toast) | 0.5d | H |
| 5D.2 | Cross-tab sign-out via `StorageEvent` listener | 0.25d | H |
| 5D.3 | File upload XHR progress events (replace fetch with XHR for upload only; cancel + retry) | 0.75d | M |
| 5D.4 | Range filter fields (date range, number range) in filter sidebar | 0.5d | M |
| 5D.5 | Typeahead/autocomplete form fields (remote search, debounced) | 0.5d | M |
| 5D.6 | Cursor-based search URL state encoding (port `s.*` prefix scheme; verify back/forward nav) | 0.5d | M |
| 5D.7 | Audit + port any missing JSONForms field types (date-time, multi-select, nested object viewer) (work scope confirmed in Phase 0.5) | 0.75d | M |
| 5D.8 | Stub cleanup: drop or complete `relations-tree-dialog.tsx` (visual stub) | 0.25d | H |
| 5D.9 | Original Playwright spec ported and green against the new app (15 tests × 2 viewports × 2 browsers) | 0.5d | M |

**Exit criteria (Phase 5):** original Playwright spec runs green; HAL-Forms round-trip parity verified; ETag concurrency tested; all listed features ticked off in a parity checklist.

---

## Phase 6 — PDF preview & AI extraction (12.5 days, **L**) ← biggest risk

Combines PDF viewer feature parity with the AI-extraction overlay. Extraction is the highest-risk track in the whole roadmap; spike (6.1) should run during Phase 3 to de-risk the estimate.

### 6A. PDF viewer parity (~2.5 days)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 6A.1 | PDF toolbar on `@embedpdf`: search, print, fullscreen, download, zoom controls (`@embedpdf/plugin-search` + custom toolbar) | 1d | M |
| 6A.2 | Rendition-aware preview — prefer PDF rendition for Word/Excel/PowerPoint (port `rendition-helper.ts`) | 0.5d | M |
| 6A.3 | CVE-2024-4367 mitigation — verify pdfjs v5 disables JS eval by default and the posture is preserved through `@embedpdf` (test with malformed-JS fixture PDF). **Fallback if verification or any spike 6B.2 trigger fails:** swap `@embedpdf` for vanilla `pdfjs-dist@^5` + custom highlight overlay; +1.5d. Decision made before Phase 6A starts. See ADR-011. | 0.25d (+1.5d if fallback taken) | M |
| 6A.4 | Citation navigation UI (jump between occurrences) rebuilt in shadcn | 0.25d | H |
| 6A.5 | Video / non-PDF preview: port as-is from existing navigator — video poster + player, image variants. Scope confirmed by Phase 0.5 audit. No new format support. | 0.5d | M |

**Out of scope for Phase 6A — PDF byte-range / progressive streaming.** The existing navigator does lazy page rendering but downloads the full PDF first (Roel confirmed in 2026-05-08 meeting). Byte-range streaming (HTTP Range requests delivering pages on demand) is a new capability requiring a BFF with session cookies instead of the current OIDC token-per-request model. This is a separate future initiative — do not let it scope-creep into Phase 6A. Stakeholders should be informed of this distinction at Phase 6A kickoff.

### 6B. AI extraction flow (~10 days, the originally-scoped Phase 6)

**Spike timing:** 6B.1 (extraction behaviour spec) and 6B.2 (PDF coord-system reconciliation) MUST run during Phase 3, not at start of Phase 6. Their findings gate Phase 6B's commitment — the remaining 6B estimates (6B.3–6B.11) are re-rolled before Phase 6 starts. If spike outputs reveal coord-system or annotation-API mismatch, swap-out of `@embedpdf` is decided here, not mid-port.

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 6B.1 | **Spike:** read original `useEntityInstanceState.ts`, `ExtractionContext`, `extract/` and `assistant/`; produce a written behaviour spec + sequence diagrams | 1d | M |
| 6B.2 | Reconcile PDF stack: confirm `@embedpdf` annotation API supports same coord-system + click-targets as `@react-pdf-viewer/highlight`. Decide: keep `@embedpdf` or swap | 0.75d | L |
| 6B.3 | Port extract service client (`ExtractionAccessor`, `extractService/api.ts`) — typed wrapper, problem-details errors | 0.5d | H |
| 6B.4 | Port `ExtractionContext` (results, popover state, active citation) to Zustand or React Context | 0.75d | M |
| 6B.5 | PDF annotation overlay (`@embedpdf/plugin-highlight`) — bounding boxes, hover, click → emit citation event; map fractional coords to plugin position API | 1.5d | L |
| 6B.6 | `PropertyExtractionPopover` — click annotation → fill form field, with confidence/reason display | 1d | M |
| 6B.7 | Multi-LLM provider selector UI (Anthropic/OpenAI/Gemini icons, persisted preference) — depends on 0.6 decision; routes to backend extract-service, no in-browser API keys | 0.5d | H |
| 6B.8 | Classify-create flow: upload file → extract suggests entity type → continue into create form | 1.5d | M |
| 6B.9 | Tests: unit (extraction state), integration (MSW extract service), Playwright (full flow with fixture PDF) | 2d | M |
| 6B.10 | Re-enable originally-skipped Playwright extract test | 0.25d | M |
| 6B.11 | Buffer for unknown unknowns (PDF rendering quirks, coord-system mismatches) | 0.25d | L |

**Exit criteria:** PDF viewer matches production toolbar feature set; classify-create + extract-fill flow works end-to-end on ≥1 entity type with ≥1 fixture PDF; tests green.

---

## Phase 7 — Production hardening (6.5 days, **M**)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 7.1 | Global error boundary + Sentry/observability hook | 0.5d | H |
| 7.2 | 404 + 403 + 500 routes with proper UX | 0.25d | H |
| 7.3 | i18n scaffolding (i18next, locale switcher in settings, en + nl seed) | 1d | M |
| 7.4 | RBAC-aware rendering (hide actions when user lacks permission per HAL link presence) | 2.5d | M |
| 7.5 | Accessibility audit + fixes (keyboard nav, ARIA, focus traps, axe in CI threshold) | 1d | M |
| 7.6 | Performance pass: bundle analysis, code-split audit, image lazy-loading | 0.5d | M |
| 7.7 | Security review (CSP headers, OIDC token storage, XSS audit) — `/security-review` slash command | 0.5d | M |
| 7.8 | Docker + deploy manifests (Helm chart or Kubernetes YAML — match prod stack) | 0.25d | L |

**Exit criteria:** Lighthouse ≥ 90 on all axes; axe-core CI green; security review report empty of highs.

---

## Phase 8 — Custom track scaffolding (DEFERRED — ~2.5d when triggered, **M**)

**Status: deferred to post-cutover. See ADR-010.** The custom-track *strategy* is real and unchanged (one generic UI cannot fit all customers, ADR-006). The *scaffolding investment* is held until there's a concrete customer trigger.

**Trigger:** first new customer customisation is committed to start.

**Not in scope:** the existing customer UI is *not* revisited as part of this project. It remains on its current build until naturally superseded.

**OSS constraint:** custom apps cannot live in the public OSS monorepo — customer or prospect names, bespoke UI decisions, and NDA-bound logic must stay in private per-customer repos. When Phase 8 triggers, those apps consume `@contentgrid/ui`, `@contentgrid/navigator-data`, and `packages/features/*` as **published npm dependencies**, not via `pnpm workspace:*`. This makes the `@contentgrid/*` publish ceremony a hard prerequisite for Phase 8 execution. The publish ceremony (~1.5d for `navigator-data`, ~1d for `ui`) is scoped and ready to execute when the trigger fires — see *HAL adapter — Release model*, ADR-010, and ADR-013.

**Dropped from scope entirely:** the `/scaffold-ui` Claude Code skill (was 8.3). Out of team scope; if Nick wants it, he'll build it personally.

**When triggered, scope is:**

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 8.1 | Customer-app template under `apps/_template/` — minimal navigator wired to `packages/ui` and `packages/navigator-data`; declares its own feature subset | 0.5d | H |
| 8.2 | Zod-validated `customer.config.ts` schema — branding, entities visible, theme tokens, **explicit feature allowlist** (which `packages/features/*` to bundle, including `candidate` opt-in) | 0.5d | H |
| 8.4 | Documentation in `CLAUDE.md` files: how an agent should read patterns, compose a page, write tests, declare features | 0.5d | H |
| 8.5 | First real customer app generated end-to-end — uses the trigger-customer's actual brief, not a synthetic demo. Record loom for stakeholders | 1d | M |

**During the cutover:** `packages/ui` and `packages/navigator-data` stay scaffolding-friendly so trigger-time work is assembly, not redesign.

**Exit criteria (when run):** the trigger-customer's `apps/<customer>/` is buildable, deployed, and provably excludes feature code it didn't opt into; lessons feed back into `apps/_template/` for the second customer.

---

## Phase 9 — Apache-2.0 open-source release (DEFERRED — ~6 days when triggered, **M**)

**Status: deferred to post-cutover re-plan. See ADR-010.** The OSS release vision is real but not date-locked. Sequencing pushed past production cutover so we don't fight on three fronts at once.

**Trigger:** post-cutover re-plan, or a customer/stakeholder commitment that locks an OSS date.

**Pre-flight that does happen during the cutover anyway:**
- **Secrets-history scan (was 9B.1)** — run as a Phase 0 pre-flight regardless. Finding a secret in a 6-month-old branch has months of latent runway to deal with rather than blocking publication day-of. ~0.25d, escalates to ~2–3d if a real find requires history rewrite or fresh-history fork.
- **Repo hygiene (LICENSE, NOTICE, SPDX headers, CONTRIBUTING)** — can land opportunistically in spare cycles; not blocking.

When the full Phase 9 is triggered, the scope below applies. Goal: publish `contentgrid-navigator` (modernised) as Apache-2.0, matching the hygiene of sibling ContentGrid OSS repos.

### 9A. Repo hygiene (~2 days)

| #    | Task                                                                                                                                          | Estimate | Confidence |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------- |
| 9A.1 | `LICENSE` (Apache-2.0) + `NOTICE` (copyright holder + contributors + third-party notices)                                                               | 0.25d    | H          |
| 9A.2 | SPDX headers (`// SPDX-License-Identifier: Apache-2.0`) on every source file — scripted                                                       | 0.25d    | H          |
| 9A.3 | `CONTRIBUTING.md` (fork → branch → PR; DCO vs. CLA decision per ContentGrid org convention)                                                   | 0.25d    | H          |
| 9A.4 | `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1) + `SECURITY.md` (private vuln reporting + SLA)                                               | 0.25d    | H          |
| 9A.5 | `README.md` rewrite — badges, screenshots/GIF, config reference, architecture overview, contribution section                                  | 0.5d     | H          |
| 9A.6 | `.github/`: ISSUE_TEMPLATE (bug + feature), PR template, CODEOWNERS, `renovate.json` extending `github>xenit-eu/contentgrid-renovate-presets` | 0.25d    | H          |
| 9A.7 | Remove `CLAUDE.md` / `FEEDBACK.md` from repo root (move under `.claude/` or delete); add `.env.example` (no real values)                      | 0.25d    | H          |

### 9B. Pre-publication scans — blockers (~1.85 days)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 9B.1 | Full git history secrets scan: `gitleaks detect` + `trufflehog git file://.` — verify `.env` / `.env.local` never committed; `VITE_DEV_TOKEN` clean. If any secret found, history rewrite or publish OSS from a fresh-history fork | 0.25d | M |
| 9B.2 | Verify production build artefact contains no third-party LLM SDKs and no environment-injected API keys | 0.1d | H |
| 9B.3 | Dependency licence SBOM: `license-checker` + `cyclonedx-npm` — verify no GPL/AGPL/LGPL/EUPL surprises | 0.25d | M |
| 9B.4 | Triage + remediation buffer for any scan findings | 1.25d | M |

### 9C. CI / release pipeline (~1 day)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 9C.1 | Port existing navigator's `.github/workflows/ci.yml` (lint → test → build → Docker → ghcr push); swap yarn → npm/pnpm | 0.5d | H |
| 9C.2 | Release workflow: GitHub Release on tag, semver tagging, changelog (release-please or changesets) | 0.25d | H |
| 9C.3 | Container registry target wiring (per 0.5 decision; default `ghcr.io/xenit-eu/...`) | 0.25d | M |

### 9D. Docs & governance (~1 day)

**Documentation surface split** (decided before Phase 1, confirmed at Phase 9D — see ADR-015):
- In-repo `docs/` (ADRs, this analysis, roadmap) → developer/architect audience; version-controlled with code changes.
- Public docs site (9D.1) → user-facing; how to use the navigator, config reference. Deferred to Phase 9D — do not write user docs until the app is stable.
- Confluence → operational runbooks, deployment ops; existing convention, internal audience.
- Navigator-specific design documentation currently in Confluence: to be reviewed at the dedicated meeting Thijs flagged on 2026-05-08 ("we need to review clearly what goes where"). Migrate to in-repo `docs/` where appropriate.

**Action:** Nick + Thijs to align on the doc-split before Phase 1 starts, specifically to review Confluence design documentation for migration to in-repo `docs/`. Open action tracked in ADR-015.

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 9D.1 | `docs/` site (Docusaurus or VitePress) — README + architecture + config reference + "embed in a ContentGrid app" guide; deploy to GitHub Pages from CI | 0.5d | M |
| 9D.2 | Governance: maintainer list, release cadence (monthly minor, patch on demand), support policy (last N versions) | 0.25d | H |
| 9D.3 | ADR log under `docs/adr/` — collect Phase 0 decisions + drop-JsonForms ADR | 0.25d | H |

**Exit criteria:** repo passes secrets scan + licence SBOM clean; CI publishes container to chosen ghcr; docs site live; first tagged Apache-2.0 release.

---

## Phase 10 — Cutover (4.5 days, **M**)

| # | Task | Estimate | Confidence |
|---|---|---|---|
| 10.1 | Side-by-side staging deploy: original navigator + new app behind feature flag | 0.5d | M |
| 10.2 | Beta-tester pass with 2–3 internal users; collect issues | 1d | L |
| 10.3 | Triage + fix critical issues (buffer) | 2d | L |
| 10.4 | Production cutover; redirect old domain → new | 0.25d | H |
| 10.5 | Archive original repo (or hand over per 0.5 decision); update internal docs | 0.25d | H |
| 10.6 | Documented rollback plan: kill-switch criteria, DNS revert procedure, data-loss boundary | 0.5d | H |

**Exit criteria:** new app is live on production domain; original repo archived with redirect.

---

## Roll-up — cutover-first scope

| Phase                                            | Days   | Cumulative |
| ------------------------------------------------ | ------ | ---------- |
| 0. Alignment & decisions                         | 2      | 2          |
| 0.5. Entity-profile audit                        | 1.5    | 3.5        |
| 1. Monorepo + tooling                            | 7      | 10.5       |
| 2. Test scaffolding                              | 2.5    | 13         |
| 3. Component library                             | 5      | 18         |
| 4. `@contentgrid/navigator-data` extraction      | 4      | 22         |
| 5. Feature parity & correctness                  | 11     | 33         |
| 6. PDF preview & extraction                      | 12.5   | 45.5       |
| 7. Production hardening                          | 6.5    | 52         |
| 10. Cutover                                      | 4.5    | 56.5       |
| **Buffer (45%)**                                 | **25** | **81.5**   |

**Range (net engineer-days):** **64 optimistic / 81.5 realistic / 99 pessimistic** (if Phase 6 doubles). The +1.5d increase vs. the original 79d estimate reflects three task additions since the initial plan: task 1.12 (Premchitra onboarding, 0.5d Nick), task 2.6 (HAL contract tests, 0.5d), and task 6A.5 (video preview port, 0.5d).

### Deferred work (not in cutover-first scope, see ADR-010)

| Item | Days | Trigger |
|---|---|---|
| `@contentgrid/navigator-data` publish ceremony (was 4.8–4.10) | ~1.5 | First out-of-tree consumer |
| `@contentgrid/ui` publish ceremony (ADR-008) | ~1 | Console (or another consumer) adopts the design system |
| Phase 8 — Custom track scaffolding (8.3 dropped) | ~2.5 | First new customer customisation committed |
| Phase 9 — Apache-2.0 OSS release | ~6 | Post-cutover re-plan or stakeholder date-lock |
| **Total deferred** | **~11** | |

If all deferrals land within the same calendar window post-cutover (worst case), additional ~11 net engineer-days plus their own buffer. Re-plan when triggers fire — not now.

---

## Dependencies & parallelization

### Hard sequential chain (cannot be parallelized)

These must complete in order. Each is a prerequisite for everything downstream:

```
0 → 1 → 2 → (3 ∥ 4) → 5A → 6B → 7 → 10
```

- **Phase 0 → 0.5 → 1 → 2** is fully serial. No team scaling helps here. (~13d net, after Phase 0.5 insertion, Phase 1 re-estimate, and task additions 1.12 + 2.6)
- **Phase 5A (HAL-Forms) → 6B (extraction)**: extraction's `PropertyExtractionPopover` (6B.6) writes into form fields. The new HAL-Forms-driven `FieldDescriptor[]` API must exist before the popover can target fields. Without 5A, 6B.6+6B.8 will be redone.
- **Phase 6B → 7 (production hardening) → 10 (cutover)**: hardening covers final-state code; cutover needs a green build of everything.

### Soft sequential (preferred order, can overlap with care)

- **3 ∥ 4** — both depend on 2, neither depends on the other. Different engineers/agents can own each.
- **5B + 5C + 5D** depend on 4 but **not on 5A**. They can start the moment Phase 4 lands.
- **6A (PDF viewer parity)** depends on 3 (component patterns) but **not on 5A or 6B**. Start as soon as Phase 3 ships. ADR-011 fallback decision is made at end of spike 6B.2 (during Phase 3), so 6A can commit to a stack before it begins.
- **Pre-cutover OSS pre-flight** — secrets-history scan (was 9B.1) runs as a Phase 0 pre-flight regardless of OSS deferral; opportunistic LICENSE/NOTICE/SPDX hygiene can land any time without committing to Phase 9.
- **Phases 8 and 9 are deferred** — see ADR-010 and the Roll-up table.

### Critical path (cutover-first scope)

The longest dependency chain through the project:

```
0 (2) → 0.5 (1.5) → 1 (7) → 2 (2.5) → 4 (4) → 5A (3.75) → 6B (10) → 7 (6.5) → 10 (4.5)
                            = ~41.75 net engineer-days
```

This chain represents **net engineer-days on the critical path**, not wall-clock. Wall-clock is longer because: (a) Phase 0 has decisions, two of which need Xenit response (extraction LLM provider, navigator-data namespace) — external blockers, not work; (b) review cycles, integration debug, and stakeholder alignment add 25–40% overhead. Realistic wall-clock floor with infinite parallel capacity is **~7 weeks**, not 40 days.

### What parallelization buys you (cutover-first scope)

| Team size | Parallel tracks | Realistic w/ review + buffer |
|---|---|---|
| 1 engineer + agents | None | ~14 weeks |
| 2 engineers + agents | E2 picks up 5B/5C/5D, 6A, opportunistic OSS hygiene | ~10 weeks |
| 3 engineers + agents | E2 owns parity tracks; E3 owns 6A + a11y/RBAC pass | ~7 weeks |

Beyond 3 engineers there is no useful parallelism — the critical path dominates. Deferred work (Phase 8, Phase 9, publish ceremonies) re-enters the plan when triggered and adds wall-clock then, not now.

---

## Sprint plan (2-week sprints, 10 working days each)

Each sprint ends in a deployable, testable state. Showcase items are concrete demos to give stakeholders confidence. Plans below cover the **cutover-first scope only** (Phases 0–7, 10). Deferred work (Phase 8, Phase 9, publish ceremonies) re-plans into its own sprint(s) when triggered — see ADR-010.

### Sprint hygiene rules

- **No sprint ends in an undeployable state.** If 6B spills past its sprint, ship the previous green build to staging anyway and treat the spillover as the next sprint's first item.
- **Spikes go in the sprint *before* their dependent phase.** 5A bridge validation during Phase 3; 6B.1 (extraction behaviour spec) + 6B.2 (PDF coord-system reconciliation) during Phase 3. Their findings drive the ADR-011 fallback decision *before* Phase 6A starts.
- **Buffer is real work, not slack.** Absorbs spike-driven re-estimates, integration debugging, and review cycles. Don't promise it as deliverable capacity.
- **Showcase per sprint is non-negotiable.** Stakeholders see something concrete every two weeks. If there's nothing visible, the sprint plan was wrong, not the showcase rule.

---

### Single-engineer plan — 8 sprints, ~16 weeks

| Sprint | Phases | Showcase |
|---|---|---|
| **S1** | Phase 0 (2d) → 0.5 (1.5d) → Phase 1 (6.5d) → start Phase 2 (0.5d) | ADRs 001–011 signed off; both app shells deploying to their URLs; stability-flag enforcement provably blocks experimental imports from generic; entity-profile fixtures committed |
| **S2** | Finish Phase 2 (1.5d) → Phase 3 (5d) → spikes 6B.1 + 6B.2 in parallel (~1.75d) → buffer (1.75d) | Storybook covers all primitives + patterns; Playwright story snapshots baselined; spike outputs written; **ADR-011 fallback decision made** |
| **S3** | Phase 4 (4d) → Phase 5A HAL-Forms bridge + renderers (3.75d) → buffer (2.25d) | `@contentgrid/navigator-data` consumed by both apps via workspace protocol; HAL-Forms `_templates` round-trip parity test green |
| **S4** | Phase 5B ETag (1d) → 5C search/list parity (2d) → 5D easy gaps (4d) → start Phase 6A (2d) → buffer (1d) | Original navigator's Playwright spec green against new build; ETag 412 path tested; PDF viewer toolbar at parity |
| **S5** | Phase 6B (10d) — full extraction port | End-to-end classify-create + extract-fill flow on ≥1 entity type with fixture PDF; extraction tests passing |
| **S6** | Phase 6 spillover buffer (~2d) → Phase 7 first half (RBAC 2.5d, error boundaries + 404/403/500 0.75d, i18n 1d, perf pass 0.5d) → buffer | RBAC-aware action rendering visible; localised UI; bundle-size baseline reported |
| **S7** | Phase 7 finish (a11y 1d, security review 0.5d, Docker/deploy 0.25d) → start Phase 10 (staging side-by-side 0.5d, beta-tester pass 1d) → buffer | Lighthouse ≥90, axe-core green, security review report empty of highs; staging deployment for beta testers |
| **S8** | Phase 10 finish (triage 2d, cutover 0.25d, archive + rollback plan 0.75d) → buffer for cutover support | **Production cutover live**; original repo archived; rollback plan documented |

Highest-risk sprint: **S5**. If the spike outputs flag fallback or extra complexity, S5 spills into S6 and Phase 7 compresses. That's the buffer at work.

---

### Two-engineer plan — 5 sprints, ~10 weeks

E1 owns the critical path; E2 owns parallel tracks. Pairing is encouraged for spike review and cutover.

| Sprint | E1 (critical path)                                                              | E2 (parallel)                                                                                                                                   | Showcase                                                                                                             |
| ------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **S1** | Phase 0 → 0.5 → Phase 1 (lead) → start Phase 2                                  | Phase 1 CI + Playwright snapshot wiring → Phase 2 lead → start Phase 3 stories                                                                  | Both apps deploying; CI green; first 10 stories visible; fixtures committed                                          |
| **S2** | Phase 4 (4d) → Phase 5A (3.75d) → start 5B (2d)                                 | Phase 3 finish + spikes 6B.1 + 6B.2 (~3d) → Phase 5C (2d) → start 5D                                                                            | Workspace package consumed; HAL-Forms forms render real `_templates`; spike findings + **ADR-011 fallback decision** |
| **S3** | Phase 6B port — state, overlay, popover (10d)                                   | Finish 5D (3d) → Phase 6A PDF toolbar (2d) → Phase 7 first half (RBAC 2.5d, error boundaries + i18n 2d)                                         | Extraction overlay rendering on fixture PDF; PDF toolbar parity; RBAC visible; localised UI                          |
| **S4** | Phase 6B finish — extraction tests, classify-create flow, re-enabled Playwright | Phase 7 finish (a11y, security review, Docker, perf pass) + opportunistic OSS hygiene (LICENSE, NOTICE, SPDX) + Phase 0 secrets pre-flight scan | End-to-end extraction; Lighthouse + axe green; OSS pre-flight scan clean (or remediation plan if not)                |
| **S5** | Phase 10 lead — staging side-by-side, cutover, archive                          | Phase 10 support — beta-tester triage, rollback plan, internal docs update                                                                      | **Production cutover live**; original archived                                                                       |

Critical-path sprint: **S3**. If 6B over-runs, push 7's finish into S4 and compress beta-tester triage in S5.

---

### Three-engineer plan — ~3.5 sprints, ~7 weeks

E1 critical path; E2 parity + spikes; E3 hardening + opportunistic. Beyond 3 engineers there's no useful parallelism — the critical path dominates.

| Sprint | E1 | E2 | E3 | Showcase |
|---|---|---|---|---|
| **S1** | Phase 0 → 0.5 → Phase 1 (lead) | Phase 1 CI + snapshots → Phase 2 → start Phase 3 | Phase 3 stories + opportunistic OSS hygiene + secrets pre-flight scan | Monorepo + CI + first stories + fixtures + OSS pre-flight clean |
| **S2** | Phase 4 (4d) → Phase 5A (3.75d) | Phase 3 finish → spikes 6B.1 + 6B.2 → 5C → 5D start | Phase 6A PDF viewer (2d) → start Phase 7 (error boundaries, i18n, a11y audit) | Workspace package; HAL-Forms forms; PDF toolbar parity; spike outputs + **ADR-011 fallback decision** |
| **S3** | Phase 6B port (10d) | 5B ETag (1d) → finish 5D (3d) → extraction tests (in parallel with E1) | Phase 7 finish (RBAC, security review, deploy manifests, perf pass) | Extraction flow working; production hardening complete |
| **S4 (half)** | Phase 10 lead | Phase 10 beta-tester triage | Phase 10 rollback plan + internal docs | **Production cutover live** |

The 3-engineer plan trades longer sprint coordination overhead for shorter wall-clock. Worth it only when the team is already familiar with the codebase — onboarding a fresh third engineer in S1 typically erases the gain.

---

### What goes outside the sprint plan

- **Phase 8 (custom-track scaffolding):** ~2.5d when the first new customer customisation is committed. Slots in as a 1-sprint side-project, post-cutover.
- **Phase 9 (Apache-2.0 OSS release):** ~6d when re-planned post-cutover. ~1 sprint solo or ~3 days with two engineers; the secrets pre-flight from Phase 0 means most of 9B is already done.
- **`@contentgrid/navigator-data` publish ceremony:** ~1.5d when an out-of-tree consumer materialises. A handful of days inside another sprint, not a sprint of its own.
- **`@contentgrid/ui` publish ceremony:** ~1d when console (or another consumer) is ready. Same shape as above.

These are not pre-budgeted into the sprint counts above. They re-plan when their triggers fire.

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Extraction flow port doubles in size due to PDF lib mismatch | M | H | Run spike 6B.1 + 6B.2 during Phase 3; re-estimate before committing |
| PDF byte-range / progressive streaming scoped into Phase 6A by stakeholders | M | M | Explicitly out of scope — requires BFF + session-cookie auth change, a separate initiative. Communicate the distinction at Phase 6A kickoff. See analysis §1 |
| Cross-repo integration testing gap: upstream platform change silently breaks navigator | H | M | Phase 2 task 2.6 adds HAL contract test layer using MSW fixtures (ADR-014); options (a) and (c) from analysis §5A remain available if (b) is insufficient |
| HAL-Forms shadcn renderer set scope creep | L | M | `@contentgrid/hal-forms` already does parsing; bridge is small. Round-trip test (5A.6) catches drift early |
| `@contentgrid/navigator-data` version skew between consumer apps | M | M | CI check in 4.10 fails build on accidental drift; allowlist for explicit overrides |
| Layer-1 Xenit packages bump faster than expected, forcing constant peerDep widening | L | M | Compat matrix (4.9); coordinate release windows with Xenit; consider collapsing layer 2 if untenable |
| `@contentgrid/*` package version drift between repos (0.4.1 vs. 0.4.2) | L | M | Pin same versions in both; verify on Phase 4 entry; covered by 5B.3 |
| Customer-specific JSONForms behaviours not yet implemented in the new app | M | M | Audit all production entity profiles in Phase 5D.7; implement missing shadcn renderers in Phase 5A scope |
| Storybook 9 + Tailwind v4 + Playwright snapshot integration friction | L | M | Validate end-to-end in Phase 1 on one component before committing the library; fall back to Ladle if Storybook 9 blocks. ADR-009 |
| Playwright snapshot flake exceeds ~1% of CI runs | M | M | Per-story stub of variability (animations, randomised data); WebKit/Firefox visual coverage opt-in only; revisit hosted tooling only on measured pain. ADR-009 |
| `@embedpdf` coord-system or annotation API mismatch with extract-service | M | H | Spike 6B.2 during Phase 3 with explicit pass criteria; fallback to vanilla pdfjs v5 + custom highlight overlay (+1.5d). ADR-011 |
| OSS release re-plan slips past stakeholder expectation | M | M | ADR-010 names the deferral with explicit trigger; secrets pre-flight runs in Phase 0 so day-of work is mechanical when triggered |
| Custom-track scaffolding has no built artefact when first new customer asks | M | M | `packages/ui` and `packages/navigator-data` stay scaffolding-friendly during cutover; trigger-time work is assembly (~2.5d), not redesign. ADR-006, ADR-010 |
| Agent-generated tests are tautological / low-value | M | M | Human review of test PRs; require coverage of *behaviour* not *implementation* |
| Stakeholder scope creep mid-flight | H | M | Lock scope at Phase 0; new asks → post-cutover backlog |
| Secrets leaked in git history (pre-OSS publish) | L | H | Phase 9B.1 secrets scan; if found, rotate + history rewrite, or publish OSS repo from a fresh-history fork |
| OSS repo/registry decision delayed → blocks CI image-push wiring | M | M | Force decision in 0.5; escalate to Xenit leadership if no response by Phase 1 |
| ETag/optimistic-concurrency regression introduced during refactor | M | M | Integration test (5B.1) covers 412 path; agent must add to MSW handlers |
| Experimental features bleed into generic build (stability flag bypassed) | M | H | ESLint rule (1.9) blocks imports; CI bundle audit in Phase 1; PR review required to flip flag |
| Experimental URL exposed publicly without "not for production" framing | L | M | Banner enforced in 1.11; robots.txt disallow; auth-gated if needed |
| Custom-track scaffolding diverges from generic over time | M | M | Custom apps consume `packages/*` only — no copying patterns into `apps/<customer>/`; agent doc (8.4) makes this explicit |
| AI productivity multiplier underperforms calibrated 1.5–2× | M | M | Calibration is conservative vs. earlier 3–5× draft; track actuals per phase and re-roll buffer if first three phases miss |
| Xenit coordination latency (decisions 0.5, 0.8; entity-profile dump for Phase 0.5) | M | M | Lock decisions in Phase 0 kickoff; escalate to Xenit leadership if no response by end of Phase 1 |
| Phase 0.5 entity-profile audit reveals JSONForms behaviours with no clean shadcn equivalent | M | M | Audit happens early; affected shapes either get custom renderer (Phase 5A scope add) or escalate as out-of-scope before Phase 5 starts |

---

## Working agreement with Xenit team

Navigator migration tickets land in the **same Jira project as the existing Xenit sprint flow**. Confirm project key and labelling convention with Thijs before 21 May.

**Cadence:**
- Nick prepares the next sprint's navigator tickets at least 2 working days before sprint planning.
- Navigator tickets reviewed at the existing sprint planning meeting; Xenit team flags conflicts or known issues.
- Sprint planning moved to 21 May (Ascension + collective day off) — Nick must have tickets in Jira before then.

**Roles:**
- Premchitra: full-time on navigator migration; primary executor for in-flight tickets in the agentic loop (see analysis §4A).
- Nick: ADR drafts, architecture decisions, PR review, sprint prep.
- Lars / Thijs: Xenit reviewers on PRs; Lars for data/HAL areas, Thijs for architecture decisions.

**Decisions:** captured as ADRs in `docs/adr/`. Not settled until merged. Escalation path = Thijs first, Ronny second.

**Action:** Nick to confirm Jira project key and ticket labelling with Thijs before 21 May.

---

## What I need from colleagues

### For the cutover-first scope

- **Decisions in Phase 0** (1 meeting, ~90 min): confirm ADRs 001–015. Storybook vs. Ladle (recommend Storybook); extraction LLM provider matrix (still pending Xenit input).
- **Xenit alignment** on: extract-service provider support (which LLMs the backend can route to); HAL-Forms `_templates` reference fixtures; experimental URL hosting (subdomain on prod env or separate?).
- **Experimental URL allocation** — domain/subdomain for `apps/navigator-experimental`; auth gating policy (open / SSO / IP-restricted).
- **Production entity profile dump** (anonymised JSON) for the audit in Phase 0.5 + HAL-Forms round-trip in 5A.6.
- **Beta tester volunteers** for Phase 10.2.

### For deferred work (when triggered)

- **OSS repo/registry target** (was Phase 0.5, now deferred with Phase 9): confirm with Xenit which repo and registry the OSS release publishes under (default `ghcr.io/xenit-eu/contentgrid-navigator`). Drives CI image-push targets when Phase 9 lights up.
- **Maintainer list** for `CODEOWNERS` and OSS governance (was 9D.2). Needed only when Phase 9 triggers.
- **First customer brief** for custom-track scaffolding (Phase 8 trigger). Specific entity model, branding, feature allowlist.
- **Console adoption appetite** for `@contentgrid/ui` (ADR-008). Owner of the console and target window.

---

## Out of scope (explicit)

- Backend/`@contentgrid/*` package changes
- Mobile-native version
- Offline mode
- New features beyond what the original or prototype already has
- SSO providers beyond the existing OIDC flow
- Migration of historical user data / saved searches from the original navigator
- **Search UI modernisation** — scoped as a separate project. This roadmap ports the existing search behaviour (range operators, typeahead, filter chips, cursor-encoded URL state, profile selector) to the new stack at parity only. New search capability (semantic search, faceted UX, AI-suggested filters, query builder, etc.) is out of scope.
- **Console-side IAM tickets** under ACC-2694 — Console is a separate app, not the navigator.

---

## ACC-2694 backlog mapping (Q1 2026 frontend tickets)

The Xenit-side epic **ACC-2694 "Small Frontend bugs/improvements Q1 2026"** carries 14 customer-observed items. They are absorbed into the modernisation as follows:

### Closed in production → must round-trip during parity (Phase 5)

| Ticket | Title | Phase |
|---|---|---|
| ACC-2702 | Display user attributes in profile | Console — out of scope |
| ACC-2788 | Sort on creation/modified date | **5D** parity |
| ACC-2796 | FTS + exact search single-field consolidation | **5C** parity |

These already ship in production, so the parity port (Phase 5) must reproduce them. Any failure here is a regression, not a new feature.

### Open — landing in **generic** during the modernisation

| Ticket | Title | Phase | Note |
|---|---|---|---|
| ACC-2707 | Entity title in breadcrumb (Dublin-core "title" concept) | **5D** | Cross-cuts profile schema; needs Xenit alignment on whether `title` becomes a first-class entity property |
| ACC-2708 | Quick search on list-of-values fields | **5C** | Bug, not enhancement |
| ACC-2709 | Inline doc/help for "exact search" semantics | **5C** | Lightweight copy + tooltip |
| ACC-2711 | Extract metadata for already-attached documents | **6B** (extension) | Adds a re-extract action to existing entities; small Phase 6B addendum |
| ACC-2792 | "Show All" → 404 + scrollbar + Search All position | **5D** | Bug fix; verify against new TanStack Router routes |
| ACC-2746 | In-context document preview pane for related lists | **5D** | Reuses preview component built in 6A |

### Open — landing in **experimental** track first, promotion candidates

These are UX improvements that benefit from customer demo feedback before promotion to generic. They live in `packages/features/<name>/` with `experimental` flag and are visible only on the experimental URL until promoted.

| Ticket | Title | Notes |
|---|---|---|
| ACC-2710 | Show related-entity titles inline in properties panel | Strong promotion candidate; depends on ACC-2707 title property |
| ACC-2793 | "Entities" → "Overview" landing screen + rename | UX rename — validate with a customer demo before generic |
| ACC-2794 | Activities pane in Overview (new/modified content feed) | Already partially in prototype; flag as `experimental` until shape is settled |
| ACC-2802 | Popout windows for preview and metadata | Needs design analysis per ticket; experimental track buys time for that |

### Deferred to **search project** (separate roadmap)

| Ticket | Title |
|---|---|
| ACC-2740 | Search on title of related entities only (not all properties) |
| (Any other search-modernisation enhancement raised post-meeting) |  |

### Out of scope (Console-side, not navigator)

| Ticket | Title |
|---|---|
| ACC-2700 | Technical ID into audit section (Console) |
| ACC-2730 | Attribute dropdown at user level in IAM (Console) |

### Effort impact

- The closed-in-production items are **already inside Phase 5's scope** (parity by definition); no additional days.
- The 6 open items routed to Phase 5/6 add **~1.5 days** of net work — absorbed by the Phase 5 12-day budget but worth flagging if more such tickets land before kick-off.
- Experimental-track items don't extend the critical path; they live alongside it in `packages/features/*` and are promoted in their own time.

---

**Hub:** [[00-ContentGrid-MOC]]
