import type { MouseEvent, ReactNode } from "react";

export interface NavigationLinkProps {
  /** The real address, when the host navigation has one (`Navigation.hrefFor`). */
  readonly href?: string;
  /** Called for a plain, unmodified left click — the only case this component itself navigates. */
  readonly onNavigate: () => void;
  readonly children: ReactNode;
  // `className`/`data-slot` only (not a generic DOM-props rest spread: `<a>` and `<button>` share
  // no common, type-safe prop surface — e.g. their event handlers are typed to different element
  // types). This still lets the two props an `asChild` primitive (shadcn's `BreadcrumbLink`) merges
  // onto its child reach the real element.
  readonly className?: string;
  readonly "data-slot"?: string;
}

/**
 * Click handler for an `<a href>` that also navigates through the host: a plain, unmodified left
 * click is turned into `onNavigate()`; every other click (a modifier key, the middle button) is
 * left for the browser to handle as a normal link click. For anchors that cannot be a
 * `NavigationLink` because a primitive (`asChild`) must put its own props on the element.
 */
export function handleNavigationClick(
  event: MouseEvent<HTMLAnchorElement>,
  onNavigate: () => void,
) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  onNavigate();
}

/**
 * A navigation action that is a real `<a href>` when the host can give one, so cmd/middle-click,
 * "copy link" and screen-reader link semantics all work — falling back to a plain `<button>` when
 * it can't (contract `navigation-context.md`). A plain left click (button 0, no modifier key) on
 * the link calls `preventDefault()` and `onNavigate()` itself; every other click (a modifier key or
 * the middle button) is left for the browser to handle as a normal link click.
 */
export function NavigationLink({
  href,
  onNavigate,
  children,
  className,
  "data-slot": dataSlot,
}: Readonly<NavigationLinkProps>) {
  if (href === undefined) {
    return (
      <button type="button" onClick={onNavigate} className={className} data-slot={dataSlot}>
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      onClick={(event) => handleNavigationClick(event, onNavigate)}
      className={className}
      data-slot={dataSlot}
    >
      {children}
    </a>
  );
}
