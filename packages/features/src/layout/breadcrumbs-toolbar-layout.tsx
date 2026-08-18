import type { ReactNode } from "react";

export interface BreadCrumbsToolBarLayoutProps {
  /**
   * Breadcrumb trail shown at the start of the toolbar — pass a
   * `<Breadcrumb>…</Breadcrumb>` from `@contentgrid/ui`.
   */
  readonly breadcrumbs?: ReactNode;
  /**
   * Additional actions / buttons shown at the end of the toolbar
   * (e.g. a "Create" button).
   */
  readonly actions?: ReactNode;
  /** Scrollable page content rendered beneath the toolbar. */
  readonly children: ReactNode;
}

/**
 * Page layout with a sticky breadcrumb + actions toolbar on top and a
 * scrollable content area beneath it. The toolbar stays fixed while only the
 * lower content region scrolls.
 *
 * Expects a height-constrained parent (e.g. a flex child with a bounded
 * height) so the internal `overflow-auto` region has something to scroll
 * within.
 */
export function BreadCrumbsToolBarLayout({
  breadcrumbs,
  actions,
  children,
}: Readonly<BreadCrumbsToolBarLayoutProps>) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-background px-4 py-3 sm:px-6 lg:px-8">
        {breadcrumbs && <div className="flex min-w-0 items-center">{breadcrumbs}</div>}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
