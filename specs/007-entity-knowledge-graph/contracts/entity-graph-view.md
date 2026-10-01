# Contract: `EntityGraphView` feature view + app route

## Feature view

**Package**: `packages/features/src/entity-graph/` (`package.json`: `{"x-stability": "stable"}` —
pre-GA exception, Principle IV). Exported as `@contentgrid/features/entity-graph`.

```ts
interface EntityGraphViewProps {
  /** Root item (path params). Primitive identifiers only (Principle VIII). */
  entityName: string;
  itemId: string;
  /** Trail after the root, from URL search. */
  trail: readonly { entityName: string; id: string; via?: string }[];
  /** Called on explore / return / deletion-induced change so the app can write the URL. */
  onTrailChange(trail: readonly { entityName: string; id: string; via?: string }[]): void;

  /** Open an item's regular detail page ("View", panel link). */
  onOpenItem(ref: { entityName: string; itemId: string }): void;
  /** Root deleted → "back to collection". */
  onOpenCollection(entityName: string): void;

  toolbar?: ViewToolbarOptions | false; // breadcrumbs/actions override (existing type)
  renderHomeLink?: …; renderCollectionLink?: …;  // same as EntityItemContentFocusView

  /** Relation problem callbacks forwarded to the details panel (same as content-focus view). */
  onMissingRelationTargetClick?: …; onBlindRelationOverwriteClick?: …; onRequiredRelationClick?: …;
}
```

**Responsibilities** (view = orchestration only):

- Gates the root profile via `useProfileEntityGate(entityName)` (R13); root item 404/403 →
  not-found/no-access page (spec edge case).
- Holds `GraphState` via `useReducer(graphReducer)`, initialised from props; syncs `trail` out via
  `onTrailChange` (the app owns the URL, the view never touches the router).
- Loads: trail items (`useEntityItem` per trail entry, via one `useQueries`-based helper), the ≤2
  expanded items' `useEntityItemRelationTargets`, pinned items; display via
  `useEntityDisplayPreferencesResolver()`.
- Builds `GraphModel` (`buildGraphModel`) → `toKnowledgeGraphProps` → `<KnowledgeGraph/>`.
- Owns menu content:
  - **Node menu** (FR-011a): _View_ → `onOpenItem`; _Explore relations_ (hidden for focus) →
    `explore`; _Delete_ iff `canDelete` → `DeleteItemDialog`.
  - **Edge menu** (FR-020/021): _Select source_, _Select target_; _Remove link_ iff `canRemove` →
    `RemoveLinkDialog`.
- Dialogs (`AlertDialog`, `size="sm"`, destructive action): name relation + both items (remove) or
  item + entity type + "permanently deleted" (delete) (FR-022/030). Pending state disables the
  action; failure renders `<ProblemAlert model={toProblemDisplayModel(error)}/>` inside the dialog
  and leaves the graph unchanged (FR-024/032); success → reducer action + `toast.success`.
- Side panel (`RightSidePanelLayout`): selection `node` → `EntityItemDetailsBody` + "Open item
  page" link (FR-011); selection `overflow` → `OverflowRelationList` (FR-017–019); nothing selected
  → focus item details.
- Trail → `Breadcrumb` above the graph (FR-014); relations outline for keyboard/AT (FR-028);
  per-relation loading/error with retry (`refetch`) (FR-027); empty-relations message.

**Files**

```text
packages/features/src/entity-graph/
├── package.json                 # x-stability
├── index.ts                     # EntityGraphView, types
├── views/entity-graph-view.tsx
├── hooks/use-graph-items.ts     # trail + pinned item loading (hooks stay out of util/)
├── components/
│   ├── graph-trail-breadcrumb.tsx
│   ├── graph-details-panel.tsx
│   ├── overflow-relation-list.tsx
│   ├── remove-link-dialog.tsx
│   ├── delete-item-dialog.tsx
│   └── graph-relations-outline.tsx
└── util/
    ├── graph-ids.ts             # graphNodeId, overflowNodeId, edge ids
    ├── graph-state.ts           # reducer + URL (de)serialisation helpers
    ├── build-graph-model.ts     # retention rule, cap 10, budget 50
    ├── to-knowledge-graph-props.ts
    ├── entity-item-label.ts
    └── *.test.ts
```

`util/` stays pure (navigator-data types only, no JSX, no hooks) per `entity-item/CLAUDE.md`
layering.

## Shared additions in `packages/features`

- `src/util/use-profile-entity-gate.ts` (NEW, R13).
- `src/preferences/resolve-entity-display-preferences.ts` + `useEntityDisplayPreferencesResolver`
  (NEW, R9); `useEntityDisplayPreferences` refactored to delegate (behaviour unchanged).
- `src/entity-item/components/entity-item-details-body.tsx` (NEW, extracted from
  `entity-item-view.tsx` and `ContentFocusEntityItemBody`; both switch to it, R12).
- Content-focus view: accept an `onOpenGraph?` callback → adds "Open in graph" to toolbar actions
  (FR-025).

## App route (both `apps/navigator` and `apps/navigator-experimental`)

`src/routes/_app/$entity/$itemId_.~graph.tsx` → URL `/$entity/$itemId/~graph?trail=[…]`

- `validateSearch: graphSearchValidator` (hand-written, exported from the feature's `util/`):
  keeps an array of `{ e: string; id: string; via?: string }` with non-empty strings, drops
  anything else.
- `loader`: ensure root profile + root item (reuse `ensureEntityItemDetailLoaderData` pattern);
  `pendingComponent: LoadingPage`, `errorComponent`, `notFoundComponent` per Principle VIII.
- Component: reads params/search, renders `<EntityGraphView entityName itemId trail
onTrailChange={t => navigate({ search: { trail: t }, replace: false })} onOpenItem={…→
"/$entity/$itemId"} onOpenCollection={…→ "/$entity"} …/>`, plus the local
  `RelationProblemDialog` as in `$itemId.tsx`.
- `$itemId.tsx`: pass `onOpenGraph={() => navigate({ to: "/$entity/$itemId/~graph", params })}`.
