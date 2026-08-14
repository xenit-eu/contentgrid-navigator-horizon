# ADR-018 — Pagination cursor: local component state, not URL-encoded

**Date:** 2026-08-14
**Status:** Accepted
**Phase:** 5 — Feature parity & correctness (ACC-2889 review)
**Cross-references:** ADR-001 (state management), ADR-005 (router), ADR-007 (two-layer dependency model)
**Amends:** ADR-001 (narrows the "pagination cursor" item in "TanStack Router owns navigational state" and "No URL state in Zustand"), ADR-005 (narrows "sort/pagination" from the URL-state requirements list and the "source of truth" claim)

---

## Context

ADR-001 and ADR-005 state that pagination cursor is URL-encoded, sharable, and back/forward-correct, alongside filters and sort. ACC-2898 implemented exactly that: the entity list's `cursor` search param held an opaque token (never a raw backend href), resolved back to the literal `next`/`prev` href via an in-memory, `QueryClient`-cache-backed registry (`mintHrefToken` / `resolveHrefToken` in `packages/navigator-data/src/search/query-param-registry.ts`), gated by a TanStack Router `validateSearch` (`entity-search-state.ts`). This avoided ever putting a raw, attacker-shaped href in the URL while still giving pagination position a URL-durable home.

During ACC-2889 (typeahead prefix-match) review, this mechanism was reassessed on two grounds:

- **Layering.** `packages/navigator-data` is a data-fetching library — accepting `searchValues` and returning results. How an application represents state in its URL, and how URL params become `searchValues`, is the application's concern, not the fetching library's. The registry and the search-state validator lived in `navigator-data` only because the feature needed them there, not because they touched HAL/fetching at all.
- **Necessity.** The registry's only job was resolving a URL-supplied token back into a fetchable href. Whether pagination position needs to survive in the URL at all is a product question, not a given — and if it doesn't need to be read back from the URL, the entire mint/resolve mechanism (and the origin-trust concerns it existed to manage) has no reason to exist, regardless of which package would host it.

## Decision

**Pagination position is local component state (`useState` in `EntityDetailView`, `packages/features/src/entity-list/index.tsx`), not URL-encoded.** The `cursor` search param, `entitySearchStateValidator`, and the href-token registry are removed entirely — not relocated.

This narrows, but does not reverse, ADR-001's "TanStack Router owns navigational state" and ADR-005's "search params ... are the source of truth for ... pagination state": filters, sort, and other navigational state are unaffected by this ADR. Pagination cursor specifically is carved out.

Filter state (`filters` in the same component) was already local component state before this change and is unaffected — this ADR only concerns pagination cursor.

## Alternatives considered

| Option                                                                                                                                                                               | Why rejected                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Keep the ACC-2898 registry as-is, in `navigator-data`**                                                                                                                            | Keeps URL-state-adjacent logic in a package whose job is fetching data, not representing application state — the layering concern above.                                                                                                                                                                                                      |
| **Move the registry mechanism, unchanged, into `packages/features`**                                                                                                                 | Doesn't address the necessity concern: the registry exists to resolve a URL-supplied value back into a real href. If pagination state doesn't need to be reconstructed from the URL, moving it just relocates dead weight.                                                                                                                    |
| **Write-only cursor reflection** — extract a token from the current page's href and set it on the `cursor` search param whenever it changes, but never read it back to drive a fetch | Genuinely deferred, not rejected — see "Reconsider when." Restores some shareability (the URL shows _a_ cursor value) without the read-back/registry machinery, since a write-only value never needs to be resolved back into a href. Left out of this change to keep it scoped; the current implementation writes nothing to the URL at all. |

## Consequences

**Positive:**

- No href-registry, no origin-trust-adjacent token-minting logic, and no URL-search-state validator living inside `packages/navigator-data` — the data-fetching library no longer owns any piece of "how does the app represent state in its URL."
- One clear owner (the feature component) for pagination position, instead of state split across component props, router search params, and a `QueryClient`-backed side table.

**Negative / accepted costs:**

- Pagination position no longer survives a page reload, browser back/forward navigation, or a bookmarked/shared URL — a real UX regression from the ACC-2898 behavior, accepted here as a deliberate trade-off, not an oversight.
- `apps/navigator/tests/search-state.spec.ts`'s e2e coverage of "browser back/forward restores pagination position" was removed along with the capability it tested; the remaining test only verifies that Next/Previous drive real fetches against the stubbed endpoint.

## Reconsider when

- Product wants pagination position to survive reload / back-forward / bookmarking again → implement the "write-only cursor reflection" alternative above (mint a display token from the current href and write it to the URL on every page change, but never resolve it back into a request) rather than reintroducing the full ACC-2898 registry.
- A second feature needs the same "represent server-driven pagination in the URL" pattern → the write-only approach, if built, should land as a shared utility in `packages/features` (not `packages/navigator-data` — see the layering rationale above) before a third copy gets hand-rolled.

---

**Hub:** [[README|ADR Index]]
