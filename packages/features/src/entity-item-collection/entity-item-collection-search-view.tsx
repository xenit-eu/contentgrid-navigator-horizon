import type { ReactNode } from "react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { EntityItemCollectionView } from "./entity-item-collection-view";

export interface EntityItemCollectionSearchViewProps {
  readonly profile: ProfileEntity;
  /**
   * URL of the collection page to display — e.g. a cursor page resolved from
   * a next/prev link. When omitted the first (default) page is fetched.
   */
  readonly pageUrl?: string;
  /**
   * Fired when the user paginates; receives the target page's href
   * (`collection.nextHref` / `collection.prevHref`).
   */
  readonly onPageChange?: (href: string | undefined) => void;
  /** Current filter values, keyed by search property name. Defaults to no filters applied. */
  readonly filters?: Record<string, string>;
  /** Fired when the user changes or clears a filter; receives the full next filters map. */
  readonly onFiltersChange?: (filters: Record<string, string>) => void;
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
}

/**
 * Page-level wrapper around {@link EntityItemCollectionView}: owns the toolbar/breadcrumbs or
 * plain-page chrome around it, so `EntityItemCollectionView` itself stays a pure content
 * component usable in either layout.
 */
export function EntityItemCollectionSearchView({
  toolbar = false,
  breadcrumbs,
  actions,
  ...viewProps
}: Readonly<EntityItemCollectionSearchViewProps>) {
  const content = <EntityItemCollectionView {...viewProps} />;

  if (toolbar) {
    return (
      <BreadCrumbsToolBarLayout breadcrumbs={breadcrumbs} actions={actions}>
        {content}
      </BreadCrumbsToolBarLayout>
    );
  }
  return <PageLayout>{content}</PageLayout>;
}
