import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import { EntityItemCollectionBreadcrumbs } from "../breadcrumbs";
import { EntityItemCollectionView } from "../entity-item-collection";
import type { CollectionViewState } from "../entity-item-collection";
import { EntityItemPreviewView } from "../entity-item-preview";
import { useControllableState } from "../hooks/use-controllable-state";
import { useProfileEntityTarget } from "../hooks/use-profile-entity-target";
import { BreadCrumbsToolBarLayout } from "../layout";
import { ChildNavigationProvider, type Navigation, useViewNavigation } from "../navigation";
import { CreateItemAction } from "../toolbar";
import type { ViewProps } from "../types/view";

/**
 * The split view's state, as plain data the host may own or leave to the view. `collection` is the
 * list child's own state under its own key (contract `view-props-and-state.md` rule 8); the preview
 * child has no state of its own, so the selection lives next to it on the split view itself.
 */
export interface EntityItemSplitViewState {
  /** The list pane's filters, sort and page. */
  readonly collection?: CollectionViewState;
  /** The item shown in the preview pane. `undefined` shows nothing selected. */
  readonly selectedItemId?: string;
}

export type EntityItemSplitViewProps = ViewProps & {
  /** Profile entity name — never the plural path. */
  readonly entityName: string;
  /** With `onStateChange`, the host owns the state; without, the view starts from it. */
  readonly state?: EntityItemSplitViewState;
  /** Called with the full next state on every change. */
  readonly onStateChange?: (state: EntityItemSplitViewState) => void;
};

/**
 * An entity's list next to a read-only preview of the selected item. It is made of the collection
 * view (toolbar off) and the item preview view, under one breadcrumb toolbar the split view draws
 * itself (Home, collection; the collection is the current location). The preview keeps its own
 * small pane header with the item and its Open and Close actions; the list draws none.
 *
 * A row click always selects the item (a state change of this view, not a navigation), whatever the screen
 * size; opening it in a new tab, or an item of another entity, goes to the parent's navigation.
 * The layout is responsive in CSS only: from the `lg` breakpoint up the panes sit side by side;
 * below it the preview takes the full width while an item is selected (the list is hidden) and
 * the preview's Close shows the list again. The preview's Open goes to the parent's navigation
 * (the full detail view, leaving the split), and so does everything else but the row click. The
 * children do not know they are side by side. The view has no address scheme: the host reads and
 * writes `state` (the apps' list route maps `selectedItemId` to `?item=<id>`, one history entry per
 * selection, and `collection` to `s.*`, `sort` and the remembered page).
 *
 * Focus: after Close it returns to the row of the closed item (the list container when that row
 * is gone); after a selection it moves to the preview pane only when the list is hidden (below
 * `lg`), found out from the list pane's computed `display` — no JS breakpoint. On wide screens
 * focus stays on the row.
 */
export function EntityItemSplitView({ entityName, ...rest }: Readonly<EntityItemSplitViewProps>) {
  // Keyed by entity, so internal selection, filters, sort and page never carry over to another
  // entity's split (the collection view does the same for its own state).
  return <SplitBody key={entityName} entityName={entityName} {...rest} />;
}

const EMPTY_STATE: EntityItemSplitViewState = {};

function SplitBody({
  entityName,
  toolbar,
  state,
  onStateChange,
}: Readonly<EntityItemSplitViewProps>) {
  const navigation = useViewNavigation();
  const [current, update] = useControllableState({
    state,
    onStateChange,
    defaultState: state ?? EMPTY_STATE,
  });

  const listRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  // Focus requests, consumed by the effect below once the state change has committed. A ref, not
  // state: they must not cause a render, and a host that never echoes the change leaves them unused.
  const focusPreviewOnSelect = useRef(false);
  const closedRow = useRef<HTMLElement | null | undefined>(undefined);

  // `update` is stable, so the overrides handed to `ChildNavigationProvider` stay referentially
  // stable (its contract) and do not change on every selection, page or host re-render.
  const listNavigation = useMemo<Partial<Navigation>>(
    () => ({
      openItem: (itemEntityName, id, options) => {
        // A new-tab request, or an item of another entity, is not a pane change.
        if (options?.openInNewTab || itemEntityName !== entityName) {
          navigation.openItem(itemEntityName, id, options);
        } else {
          focusPreviewOnSelect.current = true;
          update((previous) => ({ ...previous, selectedItemId: id }));
        }
      },
    }),
    [navigation, entityName, update],
  );

  const closePreview = useCallback((): void => {
    // The list marks the open item's row `aria-current`; grab it before the state clears it.
    closedRow.current = listRef.current?.querySelector<HTMLElement>(
      "[role='row'][aria-current='true']",
    );
    update((previous) => ({ ...previous, selectedItemId: undefined }));
  }, [update]);

  const selectedItemId = current.selectedItemId;
  useEffect(() => {
    if (selectedItemId === undefined) {
      const row = closedRow.current;
      if (row === undefined) return;
      closedRow.current = undefined;
      (row?.isConnected ? row : listRef.current)?.focus();
    } else if (focusPreviewOnSelect.current) {
      focusPreviewOnSelect.current = false;
      // Only when the list is hidden (narrow screens) does focus have to follow the selection:
      // the row the user activated is gone from the screen. Beside the list, it stays on the row.
      if (listRef.current && getComputedStyle(listRef.current).display === "none") {
        previewRef.current?.focus();
      }
    }
  }, [selectedItemId]);

  const onCollectionChange = useCallback(
    (collection: CollectionViewState): void => update((previous) => ({ ...previous, collection })),
    [update],
  );

  // The list is ALWAYS controlled by this view (it gets `onStateChange` even when the host passed
  // none): the view owns the whole state, internal or the host's, so a list change and a
  // selection change both go through `update` with the full next state. Leaving the list
  // uncontrolled would give it a private state this view cannot report or restore.
  const selected = current.selectedItemId !== undefined;
  const panes = (
    <div className="flex h-full min-h-0">
      {/* Below `lg` the list gives way to the preview of a selected item. */}
      <div
        ref={listRef}
        role="region"
        aria-label="Collection"
        tabIndex={-1}
        className={`h-full min-w-0 flex-1 border-r outline-none ${selected ? "hidden lg:block" : ""}`}
      >
        <ChildNavigationProvider overrides={listNavigation}>
          <EntityItemCollectionView
            entityName={entityName}
            toolbar={false}
            state={current.collection}
            onStateChange={onCollectionChange}
            activeItemId={current.selectedItemId}
          />
        </ChildNavigationProvider>
      </div>
      <div
        ref={previewRef}
        role="region"
        aria-label="Preview"
        tabIndex={-1}
        className={`h-full min-w-0 flex-1 outline-none ${selected ? "" : "hidden lg:block"}`}
      >
        {current.selectedItemId === undefined ? (
          <p className="p-6 text-sm text-muted-foreground">Select an item to preview it.</p>
        ) : (
          <EntityItemPreviewView
            key={current.selectedItemId}
            entityName={entityName}
            itemId={current.selectedItemId}
            onClose={closePreview}
          />
        )}
      </div>
    </div>
  );

  if (toolbar === false) return panes;
  return (
    <SplitToolbar entityName={entityName} actions={toolbar?.actions}>
      {panes}
    </SplitToolbar>
  );
}

/**
 * The one breadcrumb toolbar for both panes: always Home › collection, the collection being the
 * current location (the selected item is named in the preview pane's own header). Its data comes
 * from the same cache entries the children read.
 */
function SplitToolbar({
  entityName,
  actions,
  children,
}: Readonly<{
  entityName: string;
  actions: ReactNode;
  children: ReactNode;
}>) {
  const result = useProfileEntityTarget({ entityName });
  const profileEntity = result.status === "success" ? result.profileEntity : undefined;

  return (
    <BreadCrumbsToolBarLayout
      contentPadded={false}
      breadcrumbs={<EntityItemCollectionBreadcrumbs profileEntity={profileEntity} />}
      actions={
        <>
          <CreateItemAction profileEntity={profileEntity} />
          {actions}
        </>
      }
    >
      {children}
    </BreadCrumbsToolBarLayout>
  );
}
