# Quickstart: Advanced Single Search Bar with Autocomplete

**Feature**: [spec.md](./spec.md) | **Contracts**: [contracts/hooks-and-components.md](./contracts/hooks-and-components.md)

## Prerequisites

- This feature lands at `"x-stability": "experimental"` (research D3) — it is only reachable through `apps/navigator-experimental`, never `apps/navigator`.
- A ContentGrid application/profile with at least one entity that has: a prefix-match or full-text-searchable attribute (for User Stories 1–3), a constrained-value (allowed-values) attribute (User Story 4), a sortable attribute (User Story 5), and a date/datetime attribute (User Story 6) — the committed fixture profiles under `packages/navigator-data/test-fixtures/hal/` already cover most of these; extend them if a scenario below has no matching fixture.

## Setup

```bash
pnpm install
pnpm --filter navigator-experimental dev   # http://localhost:5174
```

Sign in with a test account that has read access to at least one entity matching the prerequisites above, then navigate to that entity's collection page.

## Manual validation scenarios

Each scenario below maps directly to an acceptance scenario in [spec.md](./spec.md) — run them in order; later ones assume the setup from earlier ones is still in place unless stated otherwise.

1. **Core search + suggestions (User Stories 1–2)**
   - Type a value that exists in more than one searchable attribute (including one reachable only via a relation, if the fixture entity has one).
   - Confirm: suggestions appear labeled by source attribute; effective-match records appear below them, capped at 5; a relation-traversal match produces a search-term suggestion but never an effective match for the related entity itself (FR-024).
   - Keep typing — confirm the list updates every keystroke and never flickers/reorders when you pause without typing.
   - Clear the box — confirm the list returns to its unfiltered state.

2. **Suggestion budget (User Story 2, FR-025/026)**
   - Type a term matching many attributes at once (use a fixture with 5+ searchable attributes if available, or temporarily lower the cap in a local test to verify the redistribution logic in isolation via the unit tests in step 6 below — the 20-item cap is hard to hit manually with a small fixture).
   - Confirm the total number of value suggestions never exceeds 20 and no attribute shows a duplicate value.

3. **Error state (FR-027)**
   - Using browser dev tools, block the network request the suggestion query fires (or stop the dev API), then type a query.
   - Confirm a distinct error indicator appears (not the "no matches" state) with a retry action; restoring the network and retrying recovers suggestions.

4. **Selecting a suggestion (User Story 1)**
   - Select a search-term suggestion — confirm it's applied as an active filter and the list narrows; open the existing Filters dialog and confirm the same value shows there too (they share one `filters` state).
   - Repeat the search, then select an effective-match record — confirm you're taken directly to that record's detail page.

5. **Shareable URL state (User Story 3)**
   - With a search term active, copy the URL, open it in a new tab — confirm the term is pre-filled and results match. Navigate away and back via the browser's back button — confirm the term and results are restored.

6. **Enum, sort, and date shortcuts (User Stories 4–6)**
   - Type into the search surface a value matching a constrained-value field's allowed values — confirm suggestions appear with no visible loading delay.
   - Pick a sort option from the search surface — confirm the list re-sorts and the collection's own sort indicator agrees.
   - Pick a "last week" preset on a date field — confirm the list narrows to the last 7 days; then pick an explicit range for the same field — confirm it replaces the preset. Repeat on a second date field (if the fixture has one) and confirm the first field's filter is untouched.

## Automated checks

```bash
# Unit tests for the pure budget/selection/date-shortcut logic (no network, no React)
npx vitest run --project navigator-data src/hooks/collection/use-entity-search-suggestions.test.ts
npx vitest run --project features src/entity-search-bar

# Contract tests (MSW-backed) for the new hook, per the constitution's HAL contract test rule
npx vitest run --project navigator-data --grep "useEntitySearchSuggestions"

# Full features + navigator-data suites (regression check)
npx vitest run --project features --project navigator-data

# Type-check the new feature and its dependents
pnpm --filter @contentgrid/navigator-data exec tsc --noEmit -p .
pnpm --filter @contentgrid/features exec tsc --noEmit -p .
pnpm --filter @contentgrid/ui exec tsc --noEmit -p .
pnpm --filter navigator-experimental exec tsc --noEmit -p .
```

## Expected outcome

All six manual scenarios behave as described, all automated checks pass, and `apps/navigator` remains completely unchanged (this feature is unreachable from it, per its stable-only track rule).
