import type { ReactNode } from "react";
import { PAGE_GUTTER_X, type PagePadding, pagePaddingClass } from "./page-padding";

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
  /**
   * Padding applied to the scrollable content area beneath the toolbar (never the toolbar
   * strip itself, which keeps its own fixed gutters). `true` (default) applies both the
   * horizontal and vertical gutters; `false` removes all padding; `"vertical"` keeps the
   * vertical gutter but drops the horizontal one — for content that should run edge to edge
   * (e.g. a content-focus preview panel) while still keeping breathing room above/below;
   * `"bottom"` drops both the horizontal gutter and the top vertical one, keeping only the
   * bottom gutter — for content sitting directly beneath this layout's own toolbar strip, which
   * already has its own bottom padding, so `"vertical"`'s extra top gutter would just double
   * that gap.
   */
  readonly contentPadded?: PagePadding;
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
  contentPadded = true,
  children,
}: Readonly<BreadCrumbsToolBarLayoutProps>) {
  const contentClasses = ["min-h-0 flex-1 overflow-auto", pagePaddingClass(contentPadded)]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className={`flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-2 border-b bg-background py-2 ${PAGE_GUTTER_X}`}
      >
        {breadcrumbs && <div className="flex min-w-0 items-center">{breadcrumbs}</div>}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className={contentClasses}>{children}</div>
    </div>
  );
}
