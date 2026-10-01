# Quickstart & Validation: Entity Knowledge Graph

**Feature**: [spec.md](./spec.md) | Contracts: [ui pattern](./contracts/ui-knowledge-graph-pattern.md),
[navigator-data](./contracts/navigator-data-hooks.md), [view + route](./contracts/entity-graph-view.md)

## Prerequisites

- `pnpm install --frozen-lockfile` (after the reviewed lockfile change adding
  `@xyflow/react@12.11.6` to `packages/ui`).
- Verify supply chain: `pnpm why @xyflow/react` → exactly `12.11.6`; `onlyBuiltDependencies`
  still `[]`; no new build-script warning during install.

## Automated checks

```sh
pnpm typecheck
pnpm lint                                      # incl. no-unstable-features, boundary rules
pnpm test --project navigator-data       # relation-targets, infinite, delete invalidation
pnpm test --project ui                   # radial-layout, knowledge-graph component
pnpm test --project features             # graph-state, build-graph-model, view tests
pnpm --filter storybook visual                 # knowledge-graph stories baselines (ADR-009)
pnpm --filter storybook test:a11y
pnpm --filter storybook test:storybook         # WithInteraction play()
pnpm --filter navigator test:e2e tests/e2e/entity-graph.spec.ts
```

Must hold: no file in `packages/features` imports `@xyflow/react` or `radix-ui`
(`grep -r "@xyflow" packages/features apps` → empty).

## Manual run (mock API)

`apps/navigator/.env.development` with `VITE_USE_MOCK_API=true`, `VITE_DEV_TOKEN=<any>`,
`VITE_API_BASE_URL=http://localhost:5173` (mock mode now also registers
`createRelationDemoHandlers`), then `pnpm --filter navigator dev` and open
`http://localhost:5173`.

| #   | Scenario (spec ref)           | Steps                                                              | Expected                                                                                                                |
| --- | ----------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Open graph (US7, FR-025)      | Customers → customer "Big Corp" → toolbar "Open in graph"          | URL `/customers/<id>/~graph`; Big Corp at centre                                                                        |
| 2   | Relations drawn (US1)         | —                                                                  | Edge `orders` to 10 order nodes + overflow "+ ~… more" marked estimated; nodes in the customer/order preference colours |
| 3   | Colour pref (FR-009)          | Configuration → order → change colour → back                       | Order nodes update without reload                                                                                       |
| 4   | Select (US2)                  | Click an order node                                                | Ring on node; panel shows order details; menu: View / Explore relations / Delete (if permitted)                         |
| 5   | View (FR-011a)                | Menu → View                                                        | Order detail page opens                                                                                                 |
| 6   | Explore (US3)                 | Order node → Explore relations                                     | Order centred; `customer` + `products` edges; Big Corp still visible via trail edge; breadcrumb "Big Corp › order"      |
| 7   | Retention (FR-015)            | Explore a product, then its supplier                               | Only last 2 focus items expanded; Big Corp shown trail-only; ≤ 50 nodes                                                 |
| 8   | Return (FR-014)               | Click "Big Corp" in breadcrumb                                     | Big Corp re-expanded; URL trail shortened                                                                               |
| 9   | Reload (FR-026)               | Reload at step 7                                                   | Same root, trail and focus                                                                                              |
| 10  | Overflow (US4)                | Click "+ … more"                                                   | Panel lists orders with total; "Load more" pages; "Show in graph" adds node + edge, count −1                            |
| 11  | Remove link (US5)             | Click `customer` edge on an order → Remove link → confirm          | Edge gone, toast; order detail no longer lists customer                                                                 |
| 12  | Remove denied (US5.3)         | Edge on item without clear template                                | Menu has no Remove link                                                                                                 |
| 13  | Remove fails (US5.4)          | Remove required relation                                           | Dialog shows RelationConflict/Validation alert; edge stays                                                              |
| 14  | Delete (US6)                  | Product node → Delete → confirm                                    | Node + edges gone; overflow counts adjust; toast                                                                        |
| 15  | Delete blocked (US6.4)        | Delete a customer referenced by a required relation                | `requiredRelation` alert; node stays                                                                                    |
| 16  | Delete focus / root (US6.5–6) | Delete current focus; then delete root                             | Focus steps back; root → "item deleted" page with link to collection                                                    |
| 17  | Parallel & self (edge cases)  | Employee with `boss` = `colleague` member; self-related item       | Two labelled edges between the pair; self-loop drawn                                                                    |
| 18  | Keyboard (FR-028)             | Tab into canvas, Enter on node/edge, Escape; use relations outline | All actions reachable; focus returns after Escape                                                                       |
| 19  | Per-relation error (FR-027)   | Devtools: block one relation URL                                   | That relation shows error + retry; rest fine                                                                            |

Record results (and any scenario not exercisable) in the PR description, per the constitution's
browser-verification rule.
