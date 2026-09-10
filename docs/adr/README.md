Parent: [[00-ContentGrid-MOC]]

# ContentGrid Navigator — Architecture Decision Records

ADRs capture decisions made during the modernisation. Each one records context, the decision, alternatives considered, consequences, and a "reconsider when" trigger.

These live in the WORK vault during planning. They migrate to `docs/adr/` in the navigator monorepo as part of Phase 1 (with the repo bootstrap) or Phase 9D.3 (consolidated into the OSS docs site).

## Decisions

- [[ADR-001-state-management-zustand-tanstack-query]]
- [[ADR-002-monorepo-tooling-pnpm]]
- [[ADR-003-ui-stack-tailwind-shadcn]]
- [[ADR-004-halforms-form-rendering-seam]]
- [[ADR-005-router-tanstack-router]]
- [[ADR-006-three-track-delivery-model]]
- [[ADR-007-two-layer-dependency-model]]
- [[ADR-008-console-scope-ui-publish-trigger]]
- [[ADR-009-visual-regression-playwright-snapshots]]
- [[ADR-010-sequencing-cutover-first]]
- [[ADR-011-pdf-stack-embedpdf-fallback]]
- [[ADR-012-no-shadcn-cli-wrapper]]
- [[ADR-013-custom-track-private-repo-model]]
- [[ADR-014-hal-contract-tests-msw]]
- [[ADR-015-documentation-surface-split]]

## Index (legacy)

| #                                                         | Title                                                                                                  | Status                 |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------- | --- |
| [001](ADR-001-state-management-zustand-tanstack-query.md) | State management: Zustand for client, TanStack Query for server                                        | Accepted               |
| [002](ADR-002-monorepo-tooling-pnpm.md)                   | Monorepo tooling: pnpm workspaces only                                                                 | Accepted               |
| [003](ADR-003-ui-stack-tailwind-shadcn.md)                | UI stack: Tailwind v4 + shadcn/ui (drop MUI)                                                           | Accepted               |     |
| [004](ADR-004-halforms-form-rendering-seam.md)            | HAL-Forms form rendering: model-enrichment (navigator-data) vs rendering-projection (app forms module) | Accepted               |
| [005](ADR-005-router-tanstack-router.md)                  | Router: TanStack Router (drop React Router v7)                                                         | Accepted               |
| [006](ADR-006-three-track-delivery-model.md)              | Three-track delivery model: generic, experimental, custom                                              | Accepted               |
| [007](ADR-007-two-layer-dependency-model.md)              | Two-layer dependency model: existing core packages (peerDeps) + composition layer                      | Accepted               |
| [008](ADR-008-console-scope-ui-publish-trigger.md)        | Console scope: separate repo; `@contentgrid/ui` published when console adopts it                       | Accepted               |
| [009](ADR-009-visual-regression-playwright-snapshots.md)  | Visual regression: Playwright story snapshots (no Chromatic)                                           | Accepted               |
| [010](ADR-010-sequencing-cutover-first.md)                | Sequencing: cutover first; OSS, custom scaffolding, publish ceremonies deferred                        | Accepted               |
| [011](ADR-011-pdf-stack-embedpdf-fallback.md)             | PDF stack: `@embedpdf` with vanilla pdfjs v5 fallback                                                  | Accepted (provisional) |
| [012](ADR-012-no-shadcn-cli-wrapper.md)                   | No custom shadcn CLI wrapper; ContentGrid registry + lint + conventions                                | Accepted               |
| [013](ADR-013-custom-track-private-repo-model.md)         | Custom-track delivery: private per-customer repos consuming published packages                         | Accepted               |
| [014](ADR-014-hal-contract-tests-msw.md)                  | Cross-repo integration testing: HAL contract tests with MSW                                            | Accepted               |
| [015](ADR-015-documentation-surface-split.md)             | Documentation surface split: in-repo docs, public docs site, Confluence                                | Accepted               |

## Conventions

- One decision per ADR. If a decision splits into two distinct trade-offs, write two ADRs.
- Status values: `Proposed`, `Accepted`, `Superseded by ADR-xxx`, `Deprecated`.
- Every ADR has a "Reconsider when" section. ADRs are not scripture — they age, and the trigger lets future-us know when to revisit.
- Number monotonically. Don't renumber on reorganisation.

## Outstanding decisions still to capture

- ADR-016 (placeholder): Extraction LLM provider strategy — decision pending Phase 0.6 (Xenit confirmation of which providers the backend extract-service supports). Previously noted as ADR-013, renumbered because ADR-013 was used for the custom-track private repo model.
- ADR-017 (placeholder): OSS repo organisation target — decision pending Phase 0.5; deferred along with Phase 9 (see ADR-010). Previously noted as ADR-014, renumbered because ADR-014 was used for HAL contract tests.
