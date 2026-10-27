import { type ReactNode, useCallback, useMemo, useState } from "react";
import { type ProfileEntity, useEntityItem } from "@contentgrid/navigator-data";
import { EntityItemCollectionBreadcrumbs, EntityItemDetailBreadcrumbs } from "../breadcrumbs";
import { EntityItemCollectionView } from "../entity-item-collection";
import type { CollectionViewState } from "../entity-item-collection";
import { EntityItemDetailView } from "../entity-item-detail";
import { useProfileEntityTarget } from "../hooks/use-profile-entity-target";
import { BreadCrumbsToolBarLayout } from "../layout";
import { ChildNavigationProvider, type Navigation, useViewNavigation } from "../navigation";
import { CreateItemAction } from "../toolbar";
import type { ViewProps } from "../types/view";

/**
 * The split view's state, as plain data the host may own or leave to the view. `collection` is the
 * list child's own state under its own key (contract `view-props-and-state.md` rule 8); the detail
 * child has no state of its own, so the selection lives next to it on the split view itself.
 */
export interface EntityItemSplitViewState {
  /** The list pane's filters, sort and page. */
  readonly collection?: CollectionViewState;
  /** The item shown in the detail pane. `undefined` shows nothing selected. */
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
 * An entity's list next to the detail of the selected item. It is made of the collection view and
 * the item detail view, both with their toolbar off, under one toolbar the split view draws itself
 * (Home, collection and, once one is selected, item).
 *
 * Each child gets its own navigation: the list's `openItem` selects the item in the detail pane
 * (a state change, not a route change); every other call, and everything the detail pane opens
 * (e.g. a relation's item), goes to the parent's navigation. The children do not know they are
 * side by side. The view has no address scheme: the host reads and writes `state`.
 */
export function EntityItemSplitView({
  entityName,
  toolbar,
  state,
  onStateChange,
}: Readonly<EntityItemSplitViewProps>) {
  const navigation = useViewNavigation();
  const [internalState, setInternalState] = useState<EntityItemSplitViewState>(state ?? {});
  const current = onStateChange ? (state ?? {}) : internalState;

  const update = useCallback(
    (next: EntityItemSplitViewState): void => {
      if (onStateChange) onStateChange(next);
      else setInternalState(next);
    },
    [onStateChange],
  );

  const listNavigation = useMemo<Partial<Navigation>>(
    () => ({
      openItem: (itemEntityName, id, options) => {
        // A new-tab request, or an item of another entity, is not a pane change.
        if (options?.openInNewTab || itemEntityName !== entityName) {
          navigation.openItem(itemEntityName, id, options);
        } else {
          update({ ...current, selectedItemId: id });
        }
      },
    }),
    [navigation, entityName, update, current],
  );

  // The list is ALWAYS controlled by this view (it gets `onStateChange` even when the host passed
  // none): the view owns the whole state, internal or the host's, so a list change and a
  // selection change both go through `update` with the full next state. Leaving the list
  // uncontrolled would give it a private state this view cannot report or restore.
  const panes = (
    <div className="flex h-full min-h-0">
      <div className="h-full min-w-0 flex-1 border-r">
        <ChildNavigationProvider overrides={listNavigation}>
          <EntityItemCollectionView
            entityName={entityName}
            toolbar={false}
            state={current.collection}
            onStateChange={(collection) => update({ ...current, collection })}
          />
        </ChildNavigationProvider>
      </div>
      <div className="h-full min-w-0 flex-1">
        {current.selectedItemId === undefined ? (
          <p className="p-6 text-sm text-muted-foreground">Select an item to see its details.</p>
        ) : (
          <EntityItemDetailView
            key={current.selectedItemId}
            entityName={entityName}
            itemId={current.selectedItemId}
            toolbar={false}
          />
        )}
      </div>
    </div>
  );

  if (toolbar === false) return panes;
  return (
    <SplitToolbar
      entityName={entityName}
      selectedItemId={current.selectedItemId}
      actions={toolbar?.actions}
    >
      {panes}
    </SplitToolbar>
  );
}

/** The one toolbar for both panes; its data comes from the same cache entries the children read. */
function SplitToolbar({
  entityName,
  selectedItemId,
  actions,
  children,
}: Readonly<{
  entityName: string;
  selectedItemId: string | undefined;
  actions: ReactNode;
  children: ReactNode;
}>) {
  const result = useProfileEntityTarget({ entityName });
  const profileEntity = result.status === "success" ? result.profileEntity : undefined;

  return (
    <BreadCrumbsToolBarLayout
      contentPadded={false}
      breadcrumbs={
        selectedItemId === undefined ? (
          <EntityItemCollectionBreadcrumbs profileEntity={profileEntity} />
        ) : (
          <SelectedItemBreadcrumbs profileEntity={profileEntity} itemId={selectedItemId} />
        )
      }
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

function SelectedItemBreadcrumbs({
  profileEntity,
  itemId,
}: Readonly<{ profileEntity: ProfileEntity | undefined; itemId: string }>) {
  const item = useEntityItem({ profileEntity, entityId: itemId });
  return <EntityItemDetailBreadcrumbs profileEntity={profileEntity} entityItem={item.data} />;
}
