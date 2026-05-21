# ADR-010 — Sequencing: cutover first; OSS release, custom-track scaffolding, and `navigator-data` publish deferred

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

---

## Context

The original migration plan committed to three concurrent products inside one calendar window:

1. **Production cutover** — modernised navigator replaces the original at customer URLs.
2. **Apache-2.0 OSS release** — repo hygiene, secrets-history scan, license SBOM, governance, docs site, public CI/release pipeline.
3. **Custom-track scaffolding** — per-customer-app template, `customer.config.ts` schema, generator skill.

Plus an incidental fourth: **publishing `@contentgrid/navigator-data`** as a semver-versioned package (Phase 4).

Each is a project. Together, they share critical-path nodes (e.g. the OSS org decision blocks CI image-push wiring blocks cutover). Doing them concurrently raises concurrent-failure risk and makes the calendar fragile.

Separately: the team has confirmed that:
- The OSS release vision is real but not date-locked.
- The custom-track *strategy* is real (one generic UI cannot fit all customers) but the *scaffolding work* has no first concrete trigger yet — the existing customer UI is not being revisited.
- The `/scaffold-ui` Claude skill is something Nick may build personally; the team does not need it.

## Decision

**Sequence as: cutover → (then re-plan) → OSS release and custom scaffolding when triggered.**

### In scope for the cutover-first plan (Phases 0–7, 10)

| Phase | Title | In/out |
|---|---|---|
| 0 | Alignment & decisions | ✅ in |
| 0.5 | Entity-profile audit | ✅ in |
| 1 | Monorepo + tooling foundation | ✅ in |
| 2 | Test scaffolding | ✅ in |
| 3 | Component library hardening | ✅ in |
| 4 | `@contentgrid/navigator-data` extraction | ✅ in (workspace-only; publish deferred) |
| 5 | Feature parity & correctness | ✅ in |
| 6 | PDF preview & AI extraction | ✅ in |
| 7 | Production hardening | ✅ in |
| 8 | Custom track scaffolding | ❌ deferred — triggered by first new customer customisation |
| 9 | Apache-2.0 OSS release | ❌ deferred — re-plan post-cutover |
| 10 | Cutover | ✅ in |

### Deferred work and triggers

**Phase 8 — Custom track scaffolding.**
- Trigger: first new customer customisation is committed.
- Drop entirely: `/scaffold-ui` Claude skill (out of team scope).
- Build at trigger time: `apps/_template/` skeleton, `customer.config.ts` Zod schema, per-package CLAUDE.md docs.
- The existing customer UI is **not** revisited as part of this migration.
- **Publish ceremony is a hard prerequisite for Phase 8.** Custom apps cannot live in the public OSS monorepo (NDA-bound logic, prospect/customer names — Thijs confirmed on 2026-05-08: "I don't think it's okay to put in prospect names"). Custom apps live in private per-customer repos and consume `@contentgrid/ui`, `@contentgrid/navigator-data`, and `packages/features/*` as published npm dependencies (not `workspace:*`). The `@contentgrid/*` publish ceremony (~1.5d for `navigator-data`, ~1d for `ui`) must complete before Phase 8 can execute. This is not indefinitely deferred — it fires simultaneously with the Phase 8 trigger. See ADR-013 for the full custom-track private repo model.
- During the cutover, `packages/ui` and `packages/navigator-data` stay scaffolding-friendly so trigger-time work is assembly, not redesign.

**Phase 9 — Apache-2.0 OSS release.**
- Trigger: post-cutover re-plan. Vision is real, no date is locked.
- Until then: repo hygiene tasks (LICENSE, NOTICE, SPDX headers) can land opportunistically without committing to the full Phase 9 scope.
- Secrets-history scan (9B.1) should be run as a Phase 0 pre-flight regardless — finding a secret in a 6-month-old branch has months of latent runway to deal with rather than blocking publication day-of.

**`@contentgrid/navigator-data` publish (was Phase 4.8–4.10).**
- Trigger: first out-of-tree consumer (custom-track app moves out of monorepo, the ContentGrid console adopts it, or OSS release).
- Build at trigger time: changesets + `npm publish` workflow + compat matrix + version-pin CI check (~1.5d).
- Until then: `packages/navigator-data` is consumed via `pnpm workspace:*`. Surface stays publish-ready (peerDeps declared, barrel exports clean) so the trigger-time work is mechanical.

**`@contentgrid/ui` publish (ADR-008).**
- Trigger: console (or another out-of-tree consumer) is ready to adopt the new design system.
- Until then: workspace-only, exactly as designed in Phase 1.

## Why cutover first

- **Single-front discipline.** Three concurrent products share critical-path nodes; one slipped decision cascades into all three. Sequencing them is a 0-day cost that meaningfully lowers concurrent-failure risk.
- **Honest demand alignment.** OSS release and custom scaffolding are pulled by *vision*; cutover is pulled by *current customer commitments*. Real demand wins on sequencing.
- **Scope clarity for OSS.** Once cutover is shipped, the OSS release has a stable target to package — code that's been stress-tested in production for some time, not code that's still moving.
- **Estimate honesty.** Compressing 65d of net work into a single window with 45% buffer is achievable. Compressing 75d (with deferred work folded back in) into the same window stops being honest.

## Why not "ship everything together"

- The compounding-risk problem isn't speculative. Phase 0 has six decisions, two of which depend on Xenit response (OSS org, navigator-data namespace). If they slip a week each, every downstream phase slips.
- Concurrent CI complexity (two deploy lanes + OSS publish + npm publish) inflates Phase 1 substantially. Deferring the publish lanes keeps Phase 1 honest.
- "While we're in the area" is the most common source of scope creep in migrations. Naming the deferrals explicitly — with triggers — is the discipline that prevents it.

## What this changes in the plan

- **Total estimate:** ~79 net engineer-days (realistic) for the cutover-first scope. Down from ~95 with everything bundled.
- **Critical path:** unchanged shape (0 → 0.5 → 1 → 2 → 4 → 5A → 6B → 7 → 10), just shorter.
- **Phase 4:** drops 4.8–4.10 (~1.5d), exits via workspace protocol.
- **Phase 8:** removed from primary plan; documented as deferred with trigger.
- **Phase 9:** removed from primary plan; documented as deferred with trigger.
- **Sprint plans:** to be re-issued against the new scope.

## Consequences

**Positive:**
- One front, one calendar, one risk surface during the riskiest part of the project.
- Vision items are not abandoned — they have explicit triggers and known scope.
- Cutover scope tightens to "modernise the navigator and ship it." Easier to defend, plan, and review.

**Negative / accepted:**
- OSS release timing is now "after cutover" rather than "in parallel." Stakeholders who want a date for that need to wait for the post-cutover re-plan.
- Custom-track scaffolding doesn't exist as a built artefact when the first new customer asks. Realistic risk; mitigated by keeping `packages/*` scaffolding-friendly.
- The publish ceremony for `@contentgrid/*` packages is no longer "indefinitely deferred" — it fires simultaneously with the first-customer trigger. This is an accepted cost: the ceremony is scoped and ready (~2.5d combined), not a surprise at trigger time.
- Each deferral is one more thing to remember at trigger time. Mitigated by this ADR enumerating the triggers explicitly.

## Reconsider when

- A customer commitment locks the OSS release date. Then Phase 9 re-enters the plan with a hard deadline.
- A customer signs that requires a custom UI inside the cutover window. Then Phase 8 re-enters and concurrent-front discipline is broken — knowingly, not accidentally.
- An out-of-tree consumer for `@contentgrid/navigator-data` materialises before cutover. Then the publish ceremony moves forward into Phase 4 or shortly after.

---

**Hub:** [[README|ADR Index]]
