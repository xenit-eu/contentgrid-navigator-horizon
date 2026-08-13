import type { ReactNode } from "react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { PageTitle } from "@contentgrid/ui";
import { ErrorPage, LoadingPage } from "../app-info-pages";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { EntityItemCollectionTable } from "./entity-item-collection-table";

export interface EntityItemCollectionViewProps {
  readonly profile: ProfileEntity;
  /**
   * URL of the collection page to display — e.g. a cursor page resolved from
   * a next/prev link. When omitted the first (default) page is fetched.
   */
  readonly pageUrl?: string;
  /**
   * Render the breadcrumb toolbar on top; otherwise the content is wrapped in
   * a plain {@link PageLayout}. Defaults to `false`.
   */
  readonly toolbar?: boolean;
  /** Breadcrumb trail shown in the toolbar (only used when `toolbar` is true). */
  readonly breadcrumbs?: ReactNode;
  /** Actions / buttons shown at the end of the toolbar (only when `toolbar` is true). */
  readonly actions?: ReactNode;
  /** Fired when an entity item row is clicked; receives the item id. */
  readonly onEntityItemClick?: (itemId: string) => void;
  /**
   * Fired when the user paginates; receives the target page's href
   * (`collection.nextHref` / `collection.prevHref`).
   */
  readonly onPageChange?: (href: string | undefined) => void;
}

/**
 * App-agnostic collection view: fetches the entity's items and renders them as
 * a table, optionally inside a breadcrumb toolbar. All routing / navigation is
 * supplied by the caller through `onEntityItemClick`, `onPageChange` and
 * `breadcrumbs` — this component performs no navigation itself.
 */
export function EntityItemCollectionView({
  profile,
  pageUrl,
  toolbar = false,
  breadcrumbs,
  actions,
  onEntityItemClick,
  onPageChange,
}: Readonly<EntityItemCollectionViewProps>) {
  const collection = useEntityItemCollection(
    pageUrl ? { profileEntity: profile, url: pageUrl } : { profileEntity: profile },
  );

  const itemCountTitle = `${collection.data?.totalItems?.count ?? "-"} items ${collection.data?.totalItems?.isEstimated ? "(estimated)" : ""}`;

  const content = (
    <>
      <div className="p-4">
        <PageTitle
          header={"Entity Collection"}
          title={profile.pluralName}
          subtitle={itemCountTitle}
        />
      </div>

      {collection.isPending && <LoadingPage />}

      {collection.isError && <ErrorPage model={toProblemDisplayModel(collection.error)} />}

      {collection.isSuccess && (
        <EntityItemCollectionTable
          profile={profile}
          collection={collection.data}
          onEntityItemClick={onEntityItemClick}
          onPageChange={onPageChange}
        />
      )}
    </>
  );

  if (toolbar) {
    return (
      <BreadCrumbsToolBarLayout breadcrumbs={breadcrumbs} actions={actions}>
        {content}
      </BreadCrumbsToolBarLayout>
    );
  }
  // possibly here we should display the actions and breadcrumbs in a different way
  return <PageLayout>{content}</PageLayout>;
}
