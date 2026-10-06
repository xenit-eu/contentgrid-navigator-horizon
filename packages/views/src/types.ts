import type { AppRouterContext } from "@contentgrid/features/router-shell";
import type { ViewTarget } from "@contentgrid/navigator-data";

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

// The type lives in `@contentgrid/navigator-data`, which resolves it and must not import views.
export type { ViewTarget };
