import { type ReactNode, useMemo } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemCollectionBrowser as EntityItemCollectionFeature } from "@contentgrid/features/entity-item-collection";
import { resolveHalFormsFields } from "@contentgrid/features/hal-forms";
import { extractFilterValuesFromCollectionUrl } from "@contentgrid/features/search";
import { type ProfileEntity, toProblemDisplayModel } from "@contentgrid/navigator-data";
import { EntityItemCollectionBreadcrumbs } from "../breadcrumbs";
import { useControllableState } from "../hooks/use-controllable-state";
import { useProfileEntityTarget } from "../hooks/use-profile-entity-target";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";
import { CreateItemAction } from "../toolbar";
import type { ViewProps } from "../types/view";

/**
 * What a collection view shows: either an entity's list by its profile entity name, or a
 * collection link from the API (with or without a query string). A link's profile is found
 * through `describes`; the name is never read from the link.
 */
export type EntityItemCollectionTarget =
  | {
      /** Profile entity name — never the plural path. */
      readonly entityName: string;
    }
  | {
      /** A collection link from the API, shown as the starting page. */
      readonly collectionUrl: string;
    };

/** The collection view's state: plain data the host may own, or leave to the view. */
export interface CollectionViewState {
  /** Filter values, keyed by the search template's field names. */
  readonly filters?: Record<string, string>;
  /** The active sort, as produced by the search template's sort options (e.g. `"name,asc"`). */
  readonly sort?: string;
  /** The page being shown, from a next/prev link or the target link. `undefined` is page 1. */
  readonly pageUrl?: string;
}

export type EntityItemCollectionViewProps = ViewProps &
  EntityItemCollectionTarget & {
    /** With `onStateChange`, the host owns the state; without, the view starts from it. */
    readonly state?: CollectionViewState;
    /** Called with the full next state on every change. */
    readonly onStateChange?: (state: CollectionViewState) => void;
    /** The item shown elsewhere (e.g. a split view's preview pane); its row is marked current. */
    readonly activeItemId?: string;
  };

function describeTarget(target: EntityItemCollectionTarget): string {
  return "collectionUrl" in target
    ? `No profile describes "${target.collectionUrl}"`
    : `No profile for entity "${target.entityName}"`;
}

/**
 * The state a view opened from a link starts in: that link as the page, and the filter values it
 * carries for the search template's own fields, so the filter form shows them as active and the
 * feature keeps the page instead of discarding it as belonging to a different search.
 */
function initialStateForLink(profileEntity: ProfileEntity, url: string): CollectionViewState {
  const searchTemplate = profileEntity.searchTemplate;
  const fields = searchTemplate ? resolveHalFormsFields(searchTemplate).fields : [];
  return { filters: extractFilterValuesFromCollectionUrl(fields, url), pageUrl: url };
}

/** Shared by every render, so a host-controlled list's default has a stable identity. */
const EMPTY_COLLECTION_STATE: CollectionViewState = {};

/**
 * One entity's list: filters, table and pagination, under a Home, collection breadcrumb toolbar
 * with a create action when the profile allows creating. Resolves the target's profile itself
 * (`useProfileEntityTarget`) and draws the loading and not-found states inside the toolbar; the
 * feature gets the loaded profile and the state, and fetches the page itself. Every click that
 * opens something calls `useViewNavigation()`.
 */
export function EntityItemCollectionView({
  toolbar,
  state,
  onStateChange,
  activeItemId,
  ...target
}: Readonly<EntityItemCollectionViewProps>) {
  const result = useProfileEntityTarget(
    "collectionUrl" in target ? { url: target.collectionUrl } : target,
  );

  const loadedProfileEntity = result.status === "success" ? result.profileEntity : undefined;
  const collectionUrl = "collectionUrl" in target ? target.collectionUrl : undefined;
  // Stable between renders: the view's state hook treats a new default reference as the host
  // having answered, which would drop a pending same-tick change.
  const defaultState = useMemo(
    () =>
      loadedProfileEntity && collectionUrl !== undefined
        ? initialStateForLink(loadedProfileEntity, collectionUrl)
        : EMPTY_COLLECTION_STATE,
    [loadedProfileEntity, collectionUrl],
  );

  let content: ReactNode;
  if (result.status === "not-found") {
    content = <ErrorPage model={toProblemDisplayModel(describeTarget(target))} />;
  } else if (result.status === "pending") {
    content = <LoadingPage />;
  } else {
    content = (
      // Keyed by entity AND target link, so internal state never carries over to a different
      // entity's list, and a new link for the same entity (e.g. a different relation's
      // collection) remounts with ITS OWN starting page/filters instead of keeping the old link's.
      <CollectionBody
        key={`${result.profileEntity.name}|${"collectionUrl" in target ? target.collectionUrl : ""}`}
        profileEntity={result.profileEntity}
        initialState={state ?? defaultState}
        state={state}
        onStateChange={onStateChange}
        activeItemId={activeItemId}
      />
    );
  }

  if (toolbar === false) {
    return <PageLayout>{content}</PageLayout>;
  }

  const profileEntity = result.status === "success" ? result.profileEntity : undefined;
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={<EntityItemCollectionBreadcrumbs profileEntity={profileEntity} />}
      actions={
        <>
          <CreateItemAction profileEntity={profileEntity} />
          {toolbar?.actions}
        </>
      }
    >
      {content}
    </BreadCrumbsToolBarLayout>
  );
}

function CollectionBody({
  profileEntity,
  initialState,
  state,
  onStateChange,
  activeItemId,
}: Readonly<{
  profileEntity: ProfileEntity;
  initialState: CollectionViewState;
  state: CollectionViewState | undefined;
  onStateChange: ((state: CollectionViewState) => void) | undefined;
  activeItemId: string | undefined;
}>) {
  const navigation = useViewNavigation();
  // Controlled with no `state` yet still starts from `initialState` (the target link's own page
  // and filters) rather than an empty state, the same way the uncontrolled branch does.
  const [current, update] = useControllableState({
    state,
    onStateChange,
    defaultState: initialState,
  });

  return (
    <EntityItemCollectionFeature
      profile={profileEntity}
      filters={current.filters}
      currentSort={current.sort}
      pageUrl={current.pageUrl}
      activeItemId={activeItemId}
      // A page link belongs to the search that produced it, so a new filter or sort starts over
      // at page 1.
      onFiltersChange={(filters) =>
        update((previous) => ({ ...previous, filters, pageUrl: undefined }))
      }
      onSortChange={(sort) => update((previous) => ({ ...previous, sort, pageUrl: undefined }))}
      onPageChange={(pageUrl) => update((previous) => ({ ...previous, pageUrl }))}
      // A row click opens the item the way the host sees fit (a split view's pane shows it); the
      // row's Open action always goes to the full detail page, hence `openInFullPage`.
      onEntityItemClick={(item) => navigation.openItem(profileEntity.name, item.id)}
      onEntityItemOpen={(item) =>
        navigation.openItem(profileEntity.name, item.id, { openInFullPage: true })
      }
      entityItemHref={(item) => navigation.hrefFor?.item(profileEntity.name, item.id)}
    />
  );
}
