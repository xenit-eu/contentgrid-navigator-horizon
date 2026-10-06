# ADR-018 — Views layer between apps and features

**Date:** 2026-10-06
**Status:** Proposed — the design is approved by the reviewer (ACC-3216); the open questions below are to be settled by the team
**Amends:** [ADR-007](ADR-007-two-layer-dependency-model.md) ("apps own app-level routing, layout, feature composition")
**Spec:** [`specs/005-views-layer/`](../../specs/005-views-layer/spec.md)

---

## Context

Today there is no views layer. Page composition is spread over the route files in both apps and two folders in the features package (`features/shells` and `features/layout`).

- Route files do page work. The collection route is about 230 lines that keep filters, sort and page in step between the screen, the address and a session memo. The item route holds its own relation-problem dialog. Every route repeats the code that loads an entity's profile and shows a loading page.
- `apps/navigator` and `apps/navigator-experimental` copy the same route tree; every fix lands twice.
- Features decide page layout. `EntityItemView` and `EntityItemCollectionSearchView` wrap themselves in `PageLayout` and take `breadcrumbs`, `toolbar` and `actions` props, so they always render as a full page and cannot sit in a pane.
- Some features navigate themselves: the dashboard, the sidebar, the profile gate, the not-found page and the unsaved-changes guard call the router.
- The chat assistant needs the same screens. Its backend sends links to the data to show; today a page can only be shown through a route in the app.
- Nothing enforces boundaries. No lint rule limits what a layer imports. ADR-007 says the apps own page layout; in practice the features do.

## Decision

**Add a views layer in a new workspace package, `packages/views`, between the apps and `packages/features`. Each layer imports only from the layers below it.**

```
apps/*            routes and URL parameters; decide what "navigate" means
packages/views    which data a page needs, the toolbar, where features and child views sit
packages/features one piece of functionality, filling the space it is given
packages/ui       patterns (entity-aware building blocks), primitives (shadcn/ui)
                  (packages/navigator-data below the views and features)
```

The ten rules of the design:

1. **The app only passes plain values.** Each view exports `preload(ctx, target, state)`. The route loader turns URL parameters into a target and a state and calls it; the app never loads a `ProfileEntity`.
2. **Every view takes names or a link.** `ViewTarget` is `{ kind: "name"; entityName; itemId? }` or `{ kind: "url"; href }`. `navigator-data` resolves either into loaded objects once, finding the profile through the response's profile link or, failing that, the profiles' `describes` links; it never cuts a name out of a link. Loaded data is cached under the item's self link. What the user is looking at (filters, sort, page, active tab) is the view's state, passed separately with an optional `onStateChange`; the app maps its address to state and back and stays the only layer that knows the address format. A frontend address is never a target.
3. **Navigation goes through a context, read only by views.** The host provides one navigation object with six functions: `openHome()`, `openClassifyCreate()`, `openEntityItemCollection(entityName)`, `openItem(entityName, id)`, `openEditItem(entityName, id)` and `openCreateItem(entityName)`; the set may be extended. They are implemented page by page: the first three through PR 6, the rest with their pages. Features never read it; they report actions through callback props that their view wires to it. `openEntityItemCollection` restores filters, sort and page; the app's implementation keeps doing that from its session memo. A chat host provides its own; stories and tests provide a recording fake. A one-page-only action may stay a prop.
4. **Everything fills the space it gets.** Features and views take the full size of their parent, can shrink so inner lists scroll, add no outer padding and never size themselves to the window. Visual snapshot tests render each story in a fixed-size box (ADR-009).
5. **Views draw their own toolbar** (breadcrumbs left, actions right, shared layout). Clicks go through the navigation object. A host or parent view can turn it off. Features never draw a toolbar.
6. **Views can contain views.** A parent gives each child its own navigation object; the children do not know they are side by side. The parent's `preload` calls its children's.
7. **Stability lives on views.** The `x-stability` tag moves from features to views. A stable view that needs an experimental feature gets an experimental copy; a stable view cannot contain an experimental view.
8. **Views load the main data; features load what follows from it.** A view loads the profile entity and the item or collection and passes them down as props; a feature follows links on the object it got and never loads the main object again or builds a URL.
9. **Preferences move to `navigator-data`.** Display preferences merge the user's choices, the backend's values and a default from the profile. The hook, the merge and the store move; the app creates the store at startup with configurable storage (local storage by default).
10. **Lint enforces it.** The design says "apps only import views"; this ADR reads it as: apps import features only through views (to be confirmed in review, since apps still import the data and UI packages to bootstrap). Features never import the router, and neither do views; `packages/ui` never imports features; stable views never import experimental views. `no-unstable-features` checks views instead of features.

### What changes in ADR-007

ADR-007 says `apps/*` own "app-level routing, layout, feature composition". After this ADR, apps own routing and the meaning of "navigate"; page layout and the composition of features and child views belong to `packages/views`. Features stay "the unit of cross-track sharing" for functionality; views become the unit users get and the unit that carries the stability tag. Everything else in ADR-007 (the two layers, peer dependencies, what stays out of `navigator-data`) holds, with one consequence: moving the preference store gives `navigator-data` a Zustand peer dependency (open question 4d).

### Where the router may be used

Views and features MUST NOT use the router. Host code may: the shells area of the views package (`packages/views/src/shells/`: router setup, the app's navigation implementation) and the apps themselves.

### Pre-GA

The stability gate in the generic app stays suspended until go-live (ADR-006 amendment). When the tag moves, `allowedStability` in the generic app keeps all three tiers, and the go-live steps name views instead of features _(added by the spec author, not in the design)_.

## Why not

| Alternative                                                                | Rejected because                                                                                                            |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Keep composition in the apps (ADR-007 as written)                          | Both apps repeat it; the chat and a split view cannot reuse it.                                                             |
| A Zustand store for navigation                                             | ADR-001: Zustand is for values that change while the app runs; navigation functions are set up once.                        |
| Callback props for navigation on every view                                | Every route would pass the same functions to every view; a split view must forward them all.                                |
| Views return breadcrumbs as data _(rationale added by the spec author)_    | Each host re-implements the toolbar, and a split view must merge two sets.                                                  |
| A frontend address as the target                                           | The view would need the app's route format; routes belong to the app.                                                       |
| A folder inside `packages/features` _(rationale added by the spec author)_ | A layer boundary needs a package boundary to lint, a stability tag per view and a consumable export for other repositories. |

## Consequences

**Positive:**

- A fix to a page lands once for both apps.
- Features are reusable in panes, dialogs and the chat; a list and detail split is two existing views.
- Boundaries are enforced by lint instead of convention.
- Hosts other than the app can show the same pages from an API link.

**Negative / accepted:**

- A new package and a ten-PR migration (ACC-3216), with visual baselines changing when views start drawing what features drew.
- An experimental copy of a view can drift from the original (open question 1).
- Tagging views removes the tag from features, so nothing marks an unfinished feature inside a stable view (open question 1).
- Navigation through context is implicit; a missing provider is a development-time error.

## Open questions (settled by the team, not here)

1. How is an experimental copy of a view kept up to date with fixes to the original? Once features carry no tag, what stops an unfinished feature from entering a stable view?
2. Two panes share one address: proposal is child state reported to the parent through `onStateChange`, written by the app with a prefix per pane.
3. Where does the unsaved-changes guard go? Proposal: the feature reports whether it has unsaved changes (`onDirtyChange`); the view asks the navigation object to guard leaving (`useNavigation().guardLeave(isDirty)`) and shows the confirm dialog; each host decides how: the app with `useBlocker`, a split view before it switches a pane, the chat with only the browser prompt. `guardLeave` is part of this open proposal, not one of the six decided navigation functions. To keep the series small the guard stays where it is for now; that is a sequencing choice, not an answer.
4. Preferences: a reset per setting; can the backend lock a preference; will preferences move to the server; is the Zustand peer dependency in `navigator-data` acceptable.
5. _(Added during spec writing, not from the design review; from the design's "open point" under rule 2.)_ A search link with filters already in it: does the filter form start empty, or does the backend send the filters separately?
6. _(Added during spec writing, not from the design review.)_ Does `openCreateItem` carry new-tab semantics (the item page opens "create a related item" in a new tab today), or does the host decide?

## Reconsider when

- A second host (the chat) shows that the navigation object needs more than "open this" actions, for example guarding leaving or returning a result.
- The experimental-copy convention costs more than it saves (open question 1).
- The number of views makes one package unwieldy; it could split into per-area packages, keeping the per-view export paths.

---

**Hub:** [[README|ADR Index]]
