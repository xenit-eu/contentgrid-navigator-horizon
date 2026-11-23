import { XIcon as X } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { SheetClose } from "../../primitives/sheet";

export interface PhoneMenuHeaderProps {
  /** Extra class names applied to the header row */
  className?: string;
}

/**
 * Top row of the phone navigation drawer: the brand on the left and a 44px "Close menu" button
 * on the right. The drawer is white, so the brand uses the primary (ocean) and sky colours — not
 * the white/light-sky of the page header. Must be rendered inside the drawer's sheet (it holds a
 * `SheetClose`); pass it to `Sidebar` as `mobileHeader`.
 */
export function PhoneMenuHeader({ className }: Readonly<PhoneMenuHeaderProps>) {
  return (
    <div
      data-slot="phone-menu-header"
      className={cn("flex shrink-0 items-center justify-between px-3 pt-3 pb-1.5", className)}
    >
      <span className="text-primary flex items-center gap-2.5 text-base font-bold tracking-[0.01em]">
        <span
          aria-hidden
          className="border-primary grid size-[30px] shrink-0 place-items-center rounded-full border-[1.6px]"
        >
          <svg
            viewBox="0 0 16 16"
            className="size-4 fill-none stroke-current stroke-[1.5]"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 4l8 8M12 4l-8 8M8 2.5v11M2.5 8h11" />
          </svg>
        </span>
        <span>
          content<span className="text-[var(--sky)]">grid</span>
        </span>
      </span>
      <SheetClose
        aria-label="Close menu"
        className="text-muted-foreground hover:bg-sidebar-accent focus-visible:ring-sidebar-ring grid size-11 place-items-center rounded-md outline-hidden focus-visible:ring-2"
      >
        <X aria-hidden className="size-5" />
      </SheetClose>
    </div>
  );
}
