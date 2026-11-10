import type { ReactNode } from "react";

export interface PageLayoutProps {
  /** Page content. */
  readonly children: ReactNode;
  /**
   * Applies the standard page padding around the content. `true` (default) applies both the
   * horizontal and vertical gutters; `false` removes all padding; `"vertical"` keeps the
   * vertical gutter but drops the horizontal one — for content that should run edge to edge
   * (e.g. a content-focus preview panel) while still keeping breathing room above/below;
   * `"bottom"` drops both the horizontal gutter and the top vertical one, keeping only the
   * bottom gutter — for content directly beneath a toolbar/header that already has its own
   * bottom padding, where `"vertical"`'s extra top gutter would just double that gap.
   */
  readonly padded?: boolean | "vertical" | "bottom";
  /**
   * Fills the available height and scrolls internally (keeps the surrounding
   * chrome fixed). Defaults to `true`. Set to `false` for pages that should
   * flow with the parent scroll instead.
   */
  readonly scroll?: boolean;
  /** Extra class names appended to the container. */
  readonly className?: string;
}

/**
 * Standard page container: full-height, internally scrollable, with the
 * app's default page padding. Use for plain pages that don't need the
 * breadcrumb toolbar.
 */
export function PageLayout({
  children,
  padded = true,
  scroll = true,
  className,
}: Readonly<PageLayoutProps>) {
  const classes = [
    scroll ? "h-full min-h-0 overflow-auto" : undefined,
    padded === true ? "px-4 py-6 sm:px-6 lg:px-8" : undefined,
    padded === "vertical" ? "py-6" : undefined,
    padded === "bottom" ? "pb-6" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
