import { XIcon as X } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { SheetClose } from "../../primitives/sheet";
import { BrandLockup } from "../branding-header/brand-lockup";

export interface PhoneMenuHeaderProps {
  /** Extra class names applied to the header row */
  className?: string;
  /**
   * Called when the logo is clicked (e.g. to navigate home). The drawer closes as well. Without
   * it the lockup is not interactive.
   */
  onLogoClick?: () => void;
}

const LOGO_CLASSES = "flex min-w-0 shrink-0 items-center gap-2.5";

/**
 * Top row of the phone navigation drawer: the page header's logo and wordmark in its
 * `on-light` tone (dark logo, sky "content", ocean "grid", ocean "BY AMEXIO" on the white drawer;
 * the header's own white/accent colours in dark mode), and a 44px "Close menu" button on the right,
 * which takes the drawer's initial focus (`data-autofocus`, see `Sidebar`). Must be rendered inside the drawer's sheet (it holds a
 * `SheetClose`); pass it to `Sidebar` as `mobileHeader`.
 */
export function PhoneMenuHeader({ className, onLogoClick }: Readonly<PhoneMenuHeaderProps>) {
  return (
    <div
      data-slot="phone-menu-header"
      className={cn("flex shrink-0 items-center justify-between px-3 pt-3 pb-1.5", className)}
    >
      {onLogoClick ? (
        <SheetClose
          onClick={onLogoClick}
          className={cn(
            LOGO_CLASSES,
            "focus-visible:ring-sidebar-ring rounded-md border-0 bg-transparent p-0 text-left outline-hidden focus-visible:ring-2",
          )}
        >
          <BrandLockup tone="on-light" />
        </SheetClose>
      ) : (
        <span className={LOGO_CLASSES}>
          <BrandLockup tone="on-light" />
        </span>
      )}
      <SheetClose
        aria-label="Close menu"
        data-autofocus
        className="text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring grid size-11 place-items-center rounded-md outline-hidden focus-visible:ring-2"
      >
        <X aria-hidden className="size-5" />
      </SheetClose>
    </div>
  );
}
