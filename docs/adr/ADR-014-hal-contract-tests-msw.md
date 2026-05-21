# ADR-014 — Cross-repo integration testing: HAL contract tests with MSW

**Date:** 2026-05-08
**Status:** Accepted
**Phase:** 2 — Test scaffolding (task 2.6)
**Cross-references:** ADR-007 (two-layer dependency model), ADR-001 (state management — TanStack Query hooks)

---

## Context

A known production pain point: a backend change (e.g. an Architect or management-platform update) can break navigator features — attribute editing, relation rendering — without any navigator code changing and without any navigator test failing. Thijs raised a concrete example on 2026-05-08: "we still experience that we ship some broken combinations to production."

The navigator's Playwright tests run navigator-internal flows. They do not exercise what happens when the HAL response shapes from the platform drift from what the navigator's TanStack Query hooks expect. There is no test that catches "this `@contentgrid/*` peer-dep version + this navigator version + this platform response shape = broken."

Three mitigation options were considered:

- **(a) Publish the navigator's Playwright suite as a runnable artefact** for other CI pipelines to consume against a deployed navigator instance — heavyweight, slow, requires a running environment to target.
- **(b) Contract tests at the HAL boundary using MSW fixtures** — small, fast, in-process, reuses artefacts already being produced in Phase 0.5 and Phase 2.
- **(c) Leave cross-repo integration testing out of scope for the cutover** — deferred problem; recurring production pain continues.

## Decision

**Add a HAL contract test layer in `@contentgrid/navigator-data` using MSW handler fixtures derived from production entity profiles.**

- MSW fixtures from Phase 0.5 (entity-profile audit) and Phase 2 (task 2.4, HAL handler stubs) are extended to serve as contract assertions.
- Each fixture pair captures the shape the platform produces for a given entity type/operation and the shape the navigator's data hooks (`useEntity`, `useList`, `useRelation`, etc.) must correctly consume.
- Tests run in Vitest, in-process, alongside unit tests. No running environment required.
- When a `@contentgrid/*` peer-dep changes the response shape, or a platform change shifts the HAL contract, the fixture drifts and the test fails in CI — surfacing the breakage before it reaches production.
- Fixtures are exported from `@contentgrid/navigator-data` so any downstream consumer (custom-track apps, the console if it ever uses `navigator-data`) can run the same contract assertions against their own integration layer.

Concrete scope for Phase 2 (task 2.6): extend the MSW handlers from task 2.4 to include response-shape assertions; add at least one contract test that simulates an upstream shape change and confirms the test catches it. Scope grows as more entity profile fixtures arrive from Phase 0.5.

## Alternatives considered

| Option | Why rejected |
|---|---|
| **(a) Publish Playwright suite as runnable artefact** | Heavyweight: requires a deployed navigator instance, a live or stubbed platform, and a network. Slow. Couples CI of one repo to the runtime state of another. Rejected as a primary mechanism — may still be added as a secondary layer after Phase 2 demonstrates (b)'s coverage. |
| **(c) Leave out of scope** | Explicitly rejected. The production breakage Thijs described is a recurring class of failure, not a one-off. The cost of (b) is low (MSW handlers are being written anyway); deferring leaves a known gap open. |

## Consequences

**Positive:**
- A class of silent production breakage (platform shape change + no navigator test failure) is caught in CI before it ships.
- Fixtures are a reusable artefact: Phase 0.5 produces them for the audit; Phase 2 extends them for contract testing; Phase 5A reuses them for HAL-Forms round-trip parity tests (task 5A.6).
- Contract tests are runnable by any consumer of `@contentgrid/navigator-data` — the test layer is not navigator-internal.
- No new external dependency or running environment required.

**Negative / accepted:**
- MSW fixtures are a snapshot of the platform's response shapes at a point in time. They must be updated when the platform evolves intentionally (e.g. a deliberate HAL contract change). This is the mechanism working correctly, not a flaw — the fixture update is the review step.
- Contract tests do not catch every class of cross-repo breakage (e.g. a new platform endpoint required for a new feature). They catch shape drift at existing endpoints. Other classes of integration risk remain outside this scope.
- Small Phase 2 estimate increase: 0.5d (task 2.6) on top of the original 2.0d Phase 2 total.

## Reconsider when

- Phase 2 demonstrates that fixture maintenance overhead exceeds the value of the caught breakages. Then scope back to option (c) or a lighter-weight shape-diffing approach.
- A full integration test environment (option a) becomes available cheaply as a Xenit-provided service. Then (a) and (b) can coexist, with (b) providing fast local feedback and (a) providing environment-level confidence.
- The platform moves to a strongly-versioned API contract mechanism (e.g. explicit JSON-LD contexts, schema versioning in HAL responses). Then the contract test layer may be replaced or supplemented by the platform's own compatibility tooling.

---

## Authors

Nick Van Vynckt

---

**Hub:** [[README|ADR Index]]
