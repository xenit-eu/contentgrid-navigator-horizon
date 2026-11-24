/** How much of the standard page padding a page's content gets. */
export type PagePadding = boolean | "vertical" | "bottom";

/**
 * The page's side gutter, shared by the content and the breadcrumb toolbar so their edges line up:
 * 16px on phones, 28px from the `sm` breakpoint up.
 */
export const PAGE_GUTTER_X = "px-4 sm:px-7";

/** The class names for a page's content padding; see `PageLayoutProps.padded`. */
export function pagePaddingClass(padding: PagePadding): string | undefined {
  switch (padding) {
    case true:
      return `${PAGE_GUTTER_X} py-6`;
    case "vertical":
      return "py-6";
    case "bottom":
      return "pb-6";
    case false:
      return undefined;
  }
}
