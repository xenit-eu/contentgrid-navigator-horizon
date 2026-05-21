# ADR-013 — Custom-track delivery: private per-customer repos consuming published packages

**Date:** 2026-05-08
**Status:** Accepted
**Phase:** 0 — Alignment & decisions (clarified during 2026-05-08 review meeting)
**Cross-references:** ADR-006 (three-track delivery model), ADR-007 (two-layer dependency model), ADR-010 (cutover-first sequencing)

---

## Context

ADR-006 defines the custom track as `apps/<customer>/` entries in the monorepo, each scaffolded from `packages/ui` + `packages/features/*`. The monorepo is planned for Apache-2.0 public release (Phase 9). These two facts conflict: custom apps contain prospect names, customer-specific branding, NDA-bound business logic, and bespoke UI decisions. None of that can live in a public Apache-2.0 repo.

Thijs confirmed this constraint on 2026-05-08: "I don't think it's okay to put in prospect names."

Additionally, during the cutover scope (Phases 0–7, 10), all consuming apps live inside the monorepo and can use `pnpm workspace:*` protocol. A custom app that moves outside the monorepo cannot. It needs `@contentgrid/ui` and `@contentgrid/navigator-data` as resolvable npm packages — which requires the publish ceremony to have run first.

## Decision

**Custom apps live in private per-customer repos and consume `@contentgrid/ui`, `@contentgrid/navigator-data`, and relevant `packages/features/*` as published npm dependencies.**

- The public OSS monorepo (`contentgrid-navigator`) contains only Apache-2.0-clean content: generic app, experimental app, shared packages, tooling.
- Each customer's bespoke navigator lives in a **separate private repository** that is not part of the OSS monorepo.
- Private repos install `@contentgrid/ui` and `@contentgrid/navigator-data` from the npm registry (or ghcr-npm) — the same packages the console will consume (ADR-008).
- The `pnpm workspace:*` protocol is correct and sufficient for all in-monorepo consumers during the cutover scope. It cannot and should not be used from an out-of-tree private repo.

## Publish ceremony timing

The `@contentgrid/*` publish ceremony is a **hard prerequisite** for the first custom-track customer app, not an indefinite deferral. When the first-customer trigger fires (ADR-010), the following must complete before the customer app can be bootstrapped:

1. `@contentgrid/navigator-data` publish pipeline (~1.5d): changesets, `npm publish` workflow, CHANGELOG, peerDep compat matrix.
2. `@contentgrid/ui` publish pipeline (~1d): same pattern, with tree-shaking validation and bundle-size baseline.

Both are scoped, mechanical, and ready to execute. They fire simultaneously with the Phase 8 trigger — not as a surprise.

The `pnpm workspace:*` consumers inside the monorepo (`apps/navigator`, `apps/navigator-experimental`) are unaffected — they continue using the workspace protocol.

## Alternatives considered

| Option                                                   | Why rejected                                                                                                                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Customer apps inside the OSS monorepo**                | Rejected explicitly — prospect/customer names and NDA-bound logic cannot appear in a public Apache-2.0 repo. Confirmed by Thijs on 2026-05-08.                                                  |
| **Customer-specific branches on the OSS monorepo**       | Rejected — does not solve the naming/NDA exposure problem; creates merge-hell between customer branches and main; diverges from the OSS release.                                                |
| **Private fork of the entire OSS monorepo per customer** | Rejected — customers would carry the full generic + experimental codebase; forked copies diverge from upstream improvements and create a maintenance burden that dwarfs a thin private overlay. |
| **Feature-flag-in-production model**                     | Already rejected by ADR-006 — env-toggled experimental code in the generic build is explicitly not the model.                                                                                   |

## Consequences

**Positive:**

- The OSS monorepo stays clean: no customer names, no NDA content, no private logic.
- Private repos are small: a thin `customer.config.ts`, minimal `apps/<customer>/` overlay, consuming packages that carry the heavy lifting. The existing scaffolding-friendliness of `packages/*` (maintained during the cutover scope) makes this assembly, not redesign.
- The publish ceremony produces packages that multiple consumers (console, custom-track apps, OSS ecosystem) can all use — the cost is paid once.
- Customer repos can adopt new `@contentgrid/ui` / `@contentgrid/navigator-data` versions on their own cadence, gated by semver.

**Negative / accepted:**

- Publish ceremony (~2.5d combined) must run before the first customer app, not after. This is a pull-forward of deferred work, not new work.
- Version skew becomes possible: a private customer repo may pin an older `@contentgrid/ui` release while the OSS monorepo moves forward. Mitigated by semver discipline and avoiding gratuitous breaking changes in published packages.
- Two repos to keep in sync per customer (monorepo improvements + private overlay). Accepted — this is the OSS model.

## Reconsider when

- A customer explicitly accepts their app being open-sourced. Then `apps/<customer>/` can be a public monorepo entry after all.
- The number of customers grows to the point where managing N private repos is more friction than maintaining a monorepo with private sub-paths (e.g. via git-crypt or submodule patterns). Evaluate at that point.
- The OSS monorepo moves to a non-public license that permits including customer code. Not the current direction.

---

## Authors

Nick Van Vynckt

---

**Hub:** [[README|ADR Index]]
