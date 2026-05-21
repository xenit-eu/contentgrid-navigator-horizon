# ADR-001 — State management: Zustand for client state, TanStack Query for server state

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions
**Companion docs:** `../contentgrid-navigator-migration-analysis.md`, `../contentgrid-navigator-migration-roadmap.md`

---

## Context

The original navigator combined React Context with ad-hoc reducers for both client UI state and cached server data. This conflates two fundamentally different concerns and produces decisions that get re-litigated every time a new feature lands: where does this piece of state live? Who owns its lifecycle? How is it invalidated when the server changes underneath us?

The prototype already adopts Zustand + TanStack Query in pieces, but the boundary between them is implicit. Without a written rule, the boundary will drift — either Zustand will start caching server responses (and rot when stale), or TanStack Query consumers will reach into Zustand for things that should be server-derived. Both happen by accident under deadline pressure.

We need an explicit, durable rule for which library owns which kind of state, plus a short list of anti-patterns that we will reject in code review.

---

## Decision

**TanStack Query owns all server-derived state.** Anything that comes from, mirrors, or invalidates against the ContentGrid HAL API lives in a Query cache. Concretely:

- Entity reads, lists, search results, relations
- HAL-Forms `_templates`, profile metadata, range/typeahead options
- Mutation state (create/update/delete in flight, optimistic updates, ETag / `If-Match` policy)
- Saved searches once they move server-side (currently localStorage; see Phase 5C.5)

**Zustand owns client UI state that doesn't belong in the URL and isn't server-derived.** This is a deliberately narrow surface:

- Cross-route ephemeral UI: command palette open, sidebar collapsed, theme toggle
- Multi-component selection state on the same page
- Extraction popover state — active citation, hover annotation, current LLM selection (Phase 6B)
- Settings persisted to localStorage (branding, display prefs) until they migrate server-side

**TanStack Router owns navigational state.** Anything that should survive a refresh, be linkable, or appear in back/forward history is URL-encoded — filter chips, sort, pagination cursor, search query, active profile, entity selection where relevant.

---

## What we explicitly will not do

- **No server data in Zustand.** If you find yourself adding `entities: Entity[]` to a Zustand store, the answer is `useEntityList` instead. Caching invariants belong to TanStack Query, not us.
- **No URL state in Zustand.** Filters, sort, page cursor — all URL-encoded via TanStack Router search params. Two reasons: users share and bookmark URLs, and we get correct back/forward UX for free.
- **No single global Zustand store.** Slice by feature (`useExtractionStore`, `useCommandPaletteStore`, `useSidebarStore`). The central-store anti-pattern is what made many Redux codebases painful — we're not reproducing it.
- **No additional state libraries (Jotai, Recoil, Valtio).** Atom-level derivation solves rendering problems we don't have. Revisit only if a measured bottleneck appears that Zustand selectors cannot solve.
- **No `useContext` for state that more than one route uses.** Use Zustand. Context is fine for theming primitives or component-local injection (e.g. `<Form>` providing its descriptor to children), not for app-wide mutable state.

---

## Consequences

**Positive:**

- Every piece of state has exactly one home. New-feature decisions become a 30-second lookup, not a debate.
- Server cache invalidation is centralised in TanStack Query; mutations and optimistic updates follow one uniform pattern.
- URL-as-state means back/forward and shareable links are correct by construction, not by convention.
- Bundle size stays modest — no third state library.

**Negative / accepted costs:**

- Two mental models coexist. New contributors must learn the boundary. Mitigated by per-package `CLAUDE.md` callouts and this ADR linked from the navigator README.
- Genuinely cross-cutting state (e.g. a "unsaved changes across multiple open forms" tracker) needs a small Zustand store *plus* coordination with TanStack Query mutations. Acceptable; document the pattern in `packages/navigator-data` when it first appears.
- Refactor cost: the prototype already mixes some server-shaped data into client state. Phase 5 reviews each touched feature and migrates as part of parity work.

---

## Alternatives considered

| Option | Why rejected |
|---|---|
| **Jotai** (atom-based) | Atom granularity solves rendering issues at a scale we don't have. Complexity tax (atom families, providers, derived atoms) outweighs benefit. Reconsider only on measured perf evidence. |
| **Redux Toolkit + RTK Query** | Distinguishing features (devtools, time-travel, RTK Query) are either covered by TanStack Query or unused in production. Boilerplate cost is real and persistent. |
| **Zustand only** (no TanStack Query) | We'd be hand-rolling cache invalidation, request dedup, background refetch, optimistic updates, and ETag handling. TanStack Query is battle-tested for exactly this. |
| **React Context + `useReducer`** (original navigator) | Coarse re-renders, no async primitives, no devtools, awkward async-data flows. The original's pain is the proof. |
| **Valtio / MobX** (proxy-based) | Implicit reactivity is harder to reason about than explicit selectors. Trades clarity for ergonomics. Not worth the swap. |

---

## Reconsider when

- A *measured* rendering bottleneck appears that Zustand selector memoisation can't solve → evaluate Jotai for that hotspot only.
- Real-time collaborative editing (Y.js / Liveblocks / Convex) lands on the roadmap → server-state model changes fundamentally; warrants its own ADR.
- The Zustand store count crosses ~10 → "slice by feature" needs a stricter convention or a code generator. Don't pre-emptively design for it.
- ContentGrid backend grows a websocket / SSE channel for entity updates → invalidation strategy in TanStack Query gets a dedicated ADR.

---

## Authors

Nick Van Vynckt

---

**Hub:** [[README|ADR Index]]
