import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
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
  /** Currently active sort value, e.g. `"name,asc"`. Defaults to no sort applied. */
  readonly currentSort?: string;
  /** Fired when the user changes or clears the sort; receives the next sort value (or `undefined`). */
  readonly onSortChange?: (sort: string | undefined) => void;
  /** Fired when an entity item row is clicked; receives the item id. */
  readonly onEntityItemClick?: (item: EntityItem) => void;
}

/**
 * Search-driven wrapper around {@link EntityItemCollectionView}. It draws no toolbar or page
 * chrome and fills whatever space its parent gives it; the view above it owns the toolbar and
 * padding.
 */
export function EntityItemCollectionSearchView(
  props: Readonly<EntityItemCollectionSearchViewProps>,
) {
  return <EntityItemCollectionView {...props} />;
}
