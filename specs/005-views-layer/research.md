# Research: Views Layer Between Apps and Features

**Feature**: [spec.md](spec.md) | **Jira**: ACC-3216

This records what the code looks like today (verified against `main` on 2026-10-06), why that is a problem, and which alternatives were considered. It is input to `plan.md`, not a set of requirements.

## 1. Why a change is needed

### 1.1 Route files do page work

- `apps/navigator/src/routes/_app/$entity/index.tsx` is 230 lines. It keeps the filters, sort order and page position in step between the screen, the address and a session memo (`rememberCollectionFilters`, `rememberCollectionSort`, `rememberCollectionPageHref` and their `recall*` counterparts, all from `@contentgrid/navigator-data`). It also builds the page's breadcrumbs and the "Create" action by hand.
- `apps/navigator/src/routes/_app/$entity/$itemId.tsx` (171 lines) holds its own relation-problem dialog (`missing-relation-target`, `blind-relation-overwrite`, `required-relation`) and wires every navigation callback of the item view to router calls.
- Every route repeats the same step: read the entity name, load the profile, show a loading page until it is there (`EntityProfileGate` in `packages/features/src/shells/entity-profile-gate/` does it for the `$entity` subtree, and the collection route does it once more with `useProfileEntity` and `LoadingPage`).

### 1.2 Both apps copy the route tree

`apps/navigator` and `apps/navigator-experimental` have almost the same `src/routes` tree. A diff of the two `src` trees shows differences only in `main.tsx`, mocks, the generated route tree, root route tests and an experimental-only `components` directory. Page fixes land twice.

### 1.3 Features decide page layout

- `packages/features/src/entity-item/entity-item-view.tsx` takes `toolbar`, `breadcrumbs` and `actions` props. With `toolbar` true it wraps itself in `BreadCrumbsToolBarLayout`, otherwise in `PageLayout`.
- `packages/features/src/entity-item-collection/entity-item-collection-search-view.tsx` does the same.
- Both therefore always render as a full page (padding and scrolling come from `PageLayout`), so neither can sit in a pane next to something else.
- `packages/features/src/layout/` holds `PageLayout`, `BreadCrumbsToolBarLayout`, `RightSidePanelLayout`, `SideBarLayout` and `EntityIconBadge`; `packages/features/src/shells/` holds `auth-shell`, `entity-profile-gate` and `router-shell` (router setup, `navigator-app`, `use-open-in-new-tab`). Both folders are page composition, not features.

### 1.4 Some features navigate themselves

These files import `@tanstack/react-router` outside tests:

- `packages/features/src/dashboard/entity-count-overview.tsx` (`useNavigate`)
- `packages/features/src/layout/sidebar-layout.tsx` and `sidebar-entity-nav.tsx` (`Link`, `useNavigate`, `useParams`)
- `packages/features/src/shells/entity-profile-gate/entity-profile-gate.tsx` (`useNavigate`, `useParams`, `Outlet`)
- `packages/features/src/app-info-pages/not-found-page.tsx` (`useNavigate`)
- `packages/features/src/unsaved-changes-guard/use-unsaved-changes-guard.ts` (`useBlocker`; only the create form uses it)
- `packages/features/src/shells/router-shell/` (`navigator-app.tsx`, `use-open-in-new-tab.ts`): router setup, legitimately router-bound.

So "features never use the router" needs the shells split first: the router-bound shell code is host code, not feature code (see plan, project structure).

### 1.5 A second host needs the same screens

The chat assistant receives links to data from its backend. Today a page can only be shown through a route in the app; there is no way to show an item or list from a link, with a host-provided way to navigate.

### 1.6 Nothing enforces the boundaries

`packages/eslint-config` has one custom rule, `no-unstable-features`, which compares a package's `x-stability` against `allowedStability` per app. No rule limits which layer imports which. ADR-007 says apps own app-level routing, layout and feature composition; in practice features own the page layout.

### 1.7 What is already fine

- `ensureEntityItemDetailLoaderData` (`packages/features/src/entity-item/entity-item-loader.ts`) already works the way rule 1 wants: the route loader starts loading the item into the query cache under the key the view reads, and swallows failures so the component's own pending/error handling still runs.
- Patterns and primitives in `packages/ui` already take plain props (ADR-003).
- The stability gate in the generic app is suspended pre-GA: `apps/navigator/eslint.config.js` passes `allowedStability: ["experimental", "candidate", "stable"]` (ADR-006 amendment).

### 1.8 Preferences today

- `packages/features/src/preferences/` holds the hook (`use-entity-display-preferences.ts`), the column visibility hook, the merge, `resolve-entity-icon.ts`, `attribute-options.ts` and the store `entity-display-preferences-store.ts`.
- The store is a Zustand store created when the file is imported, with `persist` and a fixed storage name (`contentgrid-entity-display-preferences`). Nothing can change where it saves, and tests cannot swap it.
- The preferences type and the backend part already live in `@contentgrid/navigator-data`; the backend part returns nothing yet.

## 2. Alternatives considered

### 2.1 How views navigate

| Option                                      | For                                                                       | Against                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Navigation object through React context** | Set up once; the host decides what "open" means; fakes are easy for tests | Implicit dependency; a view without a provider fails                                                                       |
| Zustand store for navigation                | Reachable from anywhere                                                   | ADR-001 reserves Zustand for values that change while the app runs; navigation functions are created once and never change |
| Callback props on every view                | Explicit                                                                  | Every route passes the same set of functions to every view; a split view has to forward all of them to every child         |
| Keep router calls in features (today)       | No work                                                                   | Features cannot be shown in a host without a router, or inside a pane                                                      |

Chosen: the context. Something only one page needs, such as "after create, go to the new item", can remain a normal prop.

### 2.2 Breadcrumbs as data or views draw the toolbar

| Option                                                            | For                                         | Against                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Views draw the toolbar from the shared toolbar layout**         | One owner of chrome; a host can turn it off | The host has no say in the toolbar's contents                                                                     |
| Views return breadcrumbs and actions as data; the host draws them | Hosts could style them                      | Every host implements the same drawing; a split view must merge two data sets; breadcrumbs need navigation anyway |
| Features keep drawing it (today)                                  | No work                                     | The feature can only be a full page                                                                               |

Chosen: views draw it; a host or parent can switch it off, and features never draw it.

### 2.3 Frontend address as the target or a separate view state

| Option                                                  | For                                              | Against                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **Target (names or API link) plus separate view state** | The app stays the only layer that knows its URLs | Two inputs instead of one                                                                          |
| One frontend address as input                           | One input                                        | The view would need the app's route format; routes belong to the app; the chat has no such address |
| State folded into the target                            | Fewer parameters                                 | A target says what to show; mixing in filters makes a link and a list state indistinguishable      |

Chosen: separate. The state type is defined by each view; `onStateChange` is optional and a view without it keeps its state itself.

_Since reviewed (ACC-3216 PR #227): the "target" side of this comparison is no longer a shared type either — each view declares its own explicit props (e.g. an entity name and item id) instead of a generic `ViewTarget`; the comparison above stays as the historical record of why props and state are kept separate._

### 2.4 Where stability lives

Features are building blocks; users get views. Tagging views matches what ships. The cost is that a stable view needing an experimental feature needs an experimental copy, and the tag no longer guards features. Both costs are recorded as the first open question.

### 2.5 Where preferences live

They are read by several features. Other features already import one another (for example every HAL-Forms-driven form goes through the `hal-forms` feature), so that alone does not force preferences into the data layer: the merge, the hook and the store move into their own `user-preferences` feature in `packages/features`, which other features import. `navigator-data` keeps only the type and the backend part it already has. This also resolves open question 4(d): no new peer dependency is needed anywhere, since `packages/features` already depends on Zustand for its existing store.

### 2.6 How a link is turned into a profile

_Built in PR 3 (FR-008–FR-010), not deferred — only the host that would exercise it (the chat assistant) stays out of scope (User Story 3)._

| Option                                                                           | For                                                                         | Against                                                                                                                       |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Match the link against the profiles already loaded (`describesUrl`)**          | No URL parsing; resolves before any request for the resource itself is made | Needs every profile loaded first                                                                                              |
| Follow the response's own profile link, falling back to matching loaded profiles | Could use a profile link embedded in the response                           | The profile is needed to build the request for the resource in the first place — there is no response yet to read a link from |
| Cut the entity name out of the link                                              | Simple                                                                      | Forbidden by constitution Principle I; the API's URL shape is a server detail                                                 |

Chosen: matching against loaded profiles. `useProfileEntityTarget` resolves the target before anything about the resource itself is fetched, so there is no response to read a profile link from; `useEntityItemTarget` builds the item target the same way, sharing `useEntityItem`'s cache key with the by-name mode so the same item opened either way is loaded once.

### 2.7 Where the app's `Navigation` implementation lives

_Corrected during review (ACC-3216 PR #227): earlier drafts of this spec, ADR-018 and the
constitution bundled the app's own `Navigation` implementation together with router setup, both
inside `packages/views/src/shells/`. It does not belong there._

| Option                                                                                                                           | For                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Against                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A file under `apps/<app>/src/routes/`, ignored by the TanStack file-route generator (e.g. `-router-navigation-provider.tsx`)** | The app's own registered route tree (the `Register` augmentation) only exists inside the app; a view's hardcoded route strings (`/$entity`, `/$entity/$itemId`) typecheck against it there, so a route rename that no longer matches fails the build. Also falls inside the existing Sonar CPD exclusion for mirrored app route files (`apps/*/src/routes/**`, PR #204), so the two apps' near-identical implementations are not flagged as duplication. | One more file per app instead of one shared file.                                                                                                                                                            |
| `packages/views/src/shells/` (the original plan)                                                                                 | One file instead of two                                                                                                                                                                                                                                                                                                                                                                                                                                  | `packages/views` has no app's `Register` augmentation to typecheck a route string against, so a route rename elsewhere would not fail typecheck here — the exact gap the two-layer boundary exists to catch. |

Chosen: each app keeps its own navigation-provider file under `src/routes/` (built in PR 3,
T017). Router _setup_ (route tree creation, the app shell component, opening a link in a new
tab) is a different concern and still moves into `packages/views/src/shells/` in PR 5 (T036),
unchanged by this correction.

## 3. Unknowns that stay open

Five of the six open questions in `spec.md` stay open (question 5, filters in a link, is resolved — see §2.6). In particular, the design does not say how a child's state is prefixed in the address (question 2) or where the unsaved-changes guard lives (question 3); the tasks keep the guard where it is.
