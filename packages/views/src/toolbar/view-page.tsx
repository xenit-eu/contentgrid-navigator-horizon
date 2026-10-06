import type { ReactNode } from "react";
import { BreadCrumbsToolBarLayout, PageLayout } from "@contentgrid/features/layout";

export interface ViewPageProps {
  /** Breadcrumb trail on the left of the toolbar. */
  readonly breadcrumbs: ReactNode;
  /** Actions on the right of the toolbar. */
  readonly actions?: ReactNode;
  /**
   * Turns off the toolbar (view-toolbar contract rule 3). The content then sits in a plain page
   * container with the same padding, and the host draws whatever chrome it wants.
   */
  readonly hideToolbar?: boolean;
  /** Padding of the content area, as in `BreadCrumbsToolBarLayout`. Defaults to the page gutters. */
  readonly contentPadded?: boolean | "vertical" | "bottom";
  readonly children: ReactNode;
}

/**
 * The page chrome of a view: the toolbar (breadcrumbs left, actions right) over a scrollable,
 * padded content area, or just that content area when the toolbar is hidden. Features placed in
 * `children` fill the space they get (view-toolbar contract rules 4 and 5).
 */
export function ViewPage({
  breadcrumbs,
  actions,
  hideToolbar = false,
  contentPadded = true,
  children,
}: Readonly<ViewPageProps>) {
  if (hideToolbar) return <PageLayout padded={contentPadded}>{children}</PageLayout>;
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={breadcrumbs}
      actions={actions}
      contentPadded={contentPadded}
    >
      {children}
    </BreadCrumbsToolBarLayout>
  );
}
