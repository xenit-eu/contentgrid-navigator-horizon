import { type ReactNode, useState } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemCollectionView as EntityItemCollectionFeature } from "@contentgrid/features/entity-item-collection";
import { resolveHalFormsFields } from "@contentgrid/features/hal-forms";
import { BreadCrumbsToolBarLayout, PageLayout } from "@contentgrid/features/layout";
import { extractFilterValuesFromCollectionUrl } from "@contentgrid/features/search";
import { type ProfileEntity, toProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { EntityItemCollectionBreadcrumbs } from "../breadcrumbs";
import { useProfileEntityTarget } from "../hooks/use-profile-entity-target";
import { useViewNavigation } from "../navigation";
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
  ...target
}: Readonly<EntityItemCollectionViewProps>) {
  const navigation = useViewNavigation();
  const result = useProfileEntityTarget(
    "collectionUrl" in target ? { url: target.collectionUrl } : target,
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
        initialState={
          state ??
          ("collectionUrl" in target
            ? initialStateForLink(result.profileEntity, target.collectionUrl)
            : {})
        }
        state={state}
        onStateChange={onStateChange}
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
          {profileEntity?.createTemplate && (
            <Button onClick={() => navigation.openCreateItem(profileEntity.name)}>
              Create {profileEntity.singularName}
            </Button>
          )}
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
}: Readonly<{
  profileEntity: ProfileEntity;
  initialState: CollectionViewState;
  state: CollectionViewState | undefined;
  onStateChange: ((state: CollectionViewState) => void) | undefined;
}>) {
  const navigation = useViewNavigation();
  const [internalState, setInternalState] = useState(initialState);
  // Controlled with no `state` yet still starts from `initialState` (the target link's own page
  // and filters) rather than an empty state, the same way the uncontrolled branch does.
  const current = onStateChange ? (state ?? initialState) : internalState;

  function update(next: CollectionViewState): void {
    if (onStateChange) onStateChange(next);
    else setInternalState(next);
  }

  return (
    <EntityItemCollectionFeature
      profile={profileEntity}
      filters={current.filters}
      currentSort={current.sort}
      pageUrl={current.pageUrl}
      // A page link belongs to the search that produced it, so a new filter or sort starts over
      // at page 1.
      onFiltersChange={(filters) => update({ ...current, filters, pageUrl: undefined })}
      onSortChange={(sort) => update({ ...current, sort, pageUrl: undefined })}
      onPageChange={(pageUrl) => update({ ...current, pageUrl })}
      onEntityItemClick={(item) => navigation.openItem(profileEntity.name, item.id)}
    />
  );
}
