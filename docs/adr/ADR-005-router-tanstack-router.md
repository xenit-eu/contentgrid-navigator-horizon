# ADR-005 — Router: TanStack Router (drop React Router v7)

**Date:** 2026-04-29
**Status:** Accepted
**Phase:** 0 — Alignment & decisions

> **Amendment (2026-08-14, ADR-018):** pagination cursor is no longer part of the URL-state requirements below — it's local component state. Filter/sort search-param state and the rest of this decision are unaffected. See [ADR-018](ADR-018-pagination-cursor-not-url-encoded.md).

---

## Context

The original navigator uses React Router v7. The prototype already adopted TanStack Router with file-based routes. We commit one way for the modernised navigator.

The navigator has non-trivial URL-state requirements: cursor-encoded search filters (`s.*` prefix), profile selector, entity selection, sort/pagination, all sharable and back/forward-correct.

## Decision

**Use TanStack Router. File-based routes, fully typed search params.**

- Routes live in `apps/<app>/src/routes/` with file-based generation.
- Search params are validated via Zod and are the source of truth for filter / sort / pagination state — see ADR-001.
- Navigation guards (`beforeLoad`, `onLeave`) drive unsaved-changes prompts on dirty forms.
- Code-splitting is per-route by default.

## Why TanStack Router

- **End-to-end type safety** — links, search params, loaders, params. The compiler catches a category of bugs that React Router cannot. For a data-driven UI with rich URL state, this matters.
- **First-class search-param state.** Filter state, sort, pagination cursor — all encoded and validated in the URL with no glue code.
- **Loader-aware** — pairs cleanly with TanStack Query (which we already chose for server state, ADR-001). Same vendor; no impedance mismatch.
- **File-based routes** — agent-friendly. Adding a route is "create a file." No central registry to keep in sync.
- **Code-splitting and pending/error UI** are built-in primitives, not bolted on.

## Why React Router v7 is dropped

- v7's data APIs (loaders, actions) overlap with what TanStack Query already does. Adopting both means two sources of truth for "is this request in flight?"
- Search-param ergonomics in React Router are still string-based at the boundary. We'd write our own typed wrapper either way — at which point we may as well use the router that ships with one.
- Migration cost is real but bounded — the prototype already absorbed it.

## Alternatives considered

| Option                                | Why rejected                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| **React Router v7**                   | Status quo, but loses type safety and overlaps with TanStack Query.                    |
| **Next.js / Remix file-based router** | Forces a server runtime we don't need. Navigator is an SPA inside a host environment.  |
| **Hash routing or history-only**      | Insufficient for a multi-route app with deep links and shareable filter state.         |
| **Wouter / Reach Router**             | Smaller, but neither offers typed search params or loaders. We'd outgrow them quickly. |

## Consequences

**Positive:**

- URL is the durable source of truth for navigational state. Refresh, share, back/forward all "just work."
- Type-safe `<Link to="...">` calls fail at compile time when a route is renamed.
- Code-splitting is automatic per route — bundle size stays disciplined.
- Pairs naturally with TanStack Query (same vendor, similar APIs).

**Negative / accepted:**

- File-based generation introduces a build-time codegen step. CI must regenerate on route changes; lint checks catch staleness.
- Fewer Stack Overflow hits than React Router. Compensated by good official docs.
- Migrating any embedded host that assumes React Router patterns requires a small adapter.

## Reconsider when

- We move to a server-rendered model (Next.js / Remix). Then the framework's router is the natural choice.
- TanStack Router introduces a breaking change we can't absorb cheaply. So far, releases have been forward-compatible.

---

**Hub:** [[README|ADR Index]]
