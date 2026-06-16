import type { HalSlice } from "@contentgrid/hal";
import type { EntityItemShape } from "../shapes";
import { EntityItem } from "./entity-item";
import type ProfileEntity from "./entity-profile";

/**
 * Total item count metadata from a collection response.
 */
export interface CollectionTotalCount {
  /** The total number of items across all pages */
  count: number;
  /** Whether the count is an estimate (true) or exact (false) */
  isEstimated: boolean;
}

/**
 * Represents a paginated collection of entity items (entity-collection resource).
 *
 * Wraps a HAL collection response and provides typed access to individual EntityItem instances,
 * pagination metadata, and navigation links. Supports cursor-based pagination following HAL
 * next/prev links.
 *
 * @example
 * ```typescript
 * const collection = new EntityItemCollection(halSlice, profileEntity);
 *
 * // Access items as typed EntityItem instances
 * collection.items.forEach(item => {
 *   console.log(item.attributes);
 * });
 *
 * // Check pagination state
 * if (collection.hasNext) {
 *   const nextUrl = collection.nextHref;
 * }
 *
 * // Get total count with exact/estimate flag
 * const total = collection.totalItems;
 * if (total) {
 *   console.log(`${total.count} items${total.isEstimated ? ' (estimated)' : ''}`);
 * }
 * ```
 */
export class EntityItemCollection {
  /**
   * @param halSlice - The HAL collection resource from the API
   * @param profileEntity - The entity profile providing schema metadata for all items
   */
  public constructor(
    public readonly halSlice: HalSlice<EntityItemShape>,
    public readonly profileEntity: ProfileEntity,
  ) {}

  /**
   * Array of entity items in this collection page.
   *
   * Each item is wrapped as an EntityItem with typed attribute access.
   * Items are returned in the order specified by the API (respecting sort parameters).
   *
   * @returns Typed EntityItem instances from the current page
   */
  public get items(): readonly EntityItem[] {
    return this.halSlice.items.map((halItem) => new EntityItem(halItem, this.profileEntity));
  }

  /**
   * Total number of items in the collection across all pages.
   *
   * Returns an object containing the count and whether it's estimated or exact.
   * Returns `undefined` if no total count is available (uncommon).
   *
   * From the HAL `page` object: `total_items_exact` or `total_items_estimate`.
   *
   * @returns Total count metadata or undefined if not available
   *
   * @example
   * ```typescript
   * const total = collection.totalItems;
   * if (total) {
   *   console.log(`${total.count} items${total.isEstimated ? ' (estimated)' : ''}`);
   * }
   * ```
   */
  public get totalItems(): CollectionTotalCount | undefined {
    const pageData = (this.halSlice.data as Record<string, unknown>).page as
      | { total_items_exact?: number; total_items_estimate?: number }
      | undefined;

    if (pageData?.total_items_exact !== undefined) {
      return {
        count: pageData.total_items_exact,
        isEstimated: false,
      };
    }

    if (pageData?.total_items_estimate !== undefined) {
      return {
        count: pageData.total_items_estimate,
        isEstimated: true,
      };
    }

    return undefined;
  }

  /**
   * Number of items in the current page.
   *
   * This is the actual count of items in `this.items`, which may be less than
   * the requested page size on the last page of results.
   *
   * @returns Count of items in the current page
   */
  public get pageSize(): number {
    return this.halSlice.items.length;
  }

  /**
   * Whether there is a next page of results.
   *
   * When `true`, use `nextHref` to fetch the next page. Follow HAL links
   * directly — never construct cursor URLs manually.
   *
   * @returns True if a next page exists
   */
  public get hasNext(): boolean {
    return this.halSlice.next !== null;
  }

  /**
   * Whether there is a previous page of results.
   *
   * When `true`, use `prevHref` to fetch the previous page.
   *
   * @returns True if a previous page exists
   */
  public get hasPrevious(): boolean {
    return this.halSlice.previous !== null;
  }

  /**
   * URL for the next page of results.
   *
   * Contains an opaque cursor — never parse or modify it. Pass directly to the
   * fetch function to retrieve the next page.
   *
   * @returns Next page URL or undefined if no next page
   */
  public get nextHref(): string | undefined {
    return this.halSlice.next?.href;
  }

  /**
   * URL for the previous page of results.
   *
   * Contains an opaque cursor — never parse or modify it. Pass directly to the
   * fetch function to retrieve the previous page.
   *
   * @returns Previous page URL or undefined if no previous page
   */
  public get prevHref(): string | undefined {
    return this.halSlice.previous?.href;
  }

  /**
   * URL for the first page of results.
   *
   * Useful for resetting pagination to the beginning. May be absent on some pages.
   *
   * @returns First page URL or undefined if not available
   */
  public get firstHref(): string | undefined {
    return this.halSlice.first?.href;
  }

  /**
   * Whether this collection is empty (no items on any page).
   *
   * Shorthand for checking if both `pageSize === 0` and `totalItems.count === 0`.
   *
   * @returns True if the collection has no items
   */
  public get isEmpty(): boolean {
    return this.pageSize === 0 && (this.totalItems?.count === 0 || this.totalItems === undefined);
  }
}
