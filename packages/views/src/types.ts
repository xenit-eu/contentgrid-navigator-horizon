import type { AppRouterContext } from "@contentgrid/features/router-shell";

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
      /** A HAL link from the API. Never parsed. */
      href: string;
    };

/**
 * Props every view takes (contract `view-props-and-state.md`). With `onStateChange` the host owns
 * the state; without it the view keeps the state itself, starting from `state`.
 */
export interface ViewProps<S = never> {
  target: ViewTarget;
  state?: S;
  onStateChange?: (state: S) => void;
}

/**
 * A view's preload (contract `view-preload.md`): fills the query cache with the main data the view
 * reads first. It resolves, and never rejects, when the data is cached or when it gave up.
 */
export type ViewPreload<S> = (
  ctx: AppRouterContext,
  target: ViewTarget,
  state: S | undefined,
) => Promise<void>;
