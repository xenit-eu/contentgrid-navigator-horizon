import type { EntityItem } from "../accessors/entity-item";
import type ProfileEntity from "../accessors/entity-profile";

/**
 * What a view shows (contract `view-target.md`). By `name` from our own routes, by `url` from the
 * chat backend. A target carries no filters, sort or page.
 */
export type ViewTarget =
  | {
      kind: "name";
      /** The profile entity name, never the plural path. */
      entityName: string;
      /** The item's `id` field; absent addresses the collection. */
      itemId?: string;
    }
  | {
      kind: "url";
      /** A HAL link from the API (an item or collection link). Never parsed. */
      href: string;
    };

/**
 * What a target resolves to. The same shape for both target forms: a view never sees whether the
 * input was a name or a link.
 */
export interface ResolvedViewTarget {
  readonly profileEntity: ProfileEntity;
  /** Present when the target addresses an item. */
  readonly entityItem?: EntityItem;
  /**
   * Present when the target addresses a collection: the collection's own URL (for a link target,
   * the link as given). The view builds its request through `profileEntity.searchTemplate`.
   */
  readonly collectionUrl?: string;
}

/** No profile for the target: unknown entity name, or a link no profile describes. */
export class ViewTargetNotFoundError extends Error {
  public constructor(public readonly target: ViewTarget) {
    super(
      target.kind === "name"
        ? `No entity profile named "${target.entityName}"`
        : `No entity profile describes ${target.href}`,
    );
    this.name = "ViewTargetNotFoundError";
  }
}

/** The link is not an entity item or an entity collection. */
export class ViewTargetNotSupportedError extends Error {
  public constructor(public readonly href: string) {
    super(`${href} is not an entity item or collection`);
    this.name = "ViewTargetNotSupportedError";
  }
}

export function isViewTargetNotFound(error: unknown): error is ViewTargetNotFoundError {
  return error instanceof ViewTargetNotFoundError;
}

export function isViewTargetNotSupported(error: unknown): error is ViewTargetNotSupportedError {
  return error instanceof ViewTargetNotSupportedError;
}
