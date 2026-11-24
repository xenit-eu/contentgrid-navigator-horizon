import * as React from "react";
import { cn } from "../../lib/utils";
import { BrandLockup } from "./brand-lockup";

/** Total height of the header: 56px of content plus its 3px sky bottom border. */
export const BRANDING_HEADER_HEIGHT = "59px";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BrandingHeaderProps {
  title?: string;
  /**
   * Optional slot for actions rendered at the trailing end of the header
   * (e.g. a user-menu button or notification icon).
   */
  actions?: React.ReactNode;
  /** Extra class names applied to the root <header> element */
  className?: string;
  /** Called when the logo or brand text is clicked (e.g. to navigate home) */
  onLogoClick?: () => void;
  /**
   * Optional slot rendered right after the logo, at every width — e.g. the
   * sidebar toggle. The logo stays visible next to it on narrow screens.
   */
  leading?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BrandingHeader({
  actions,
  className,
  title,
  onLogoClick,
  leading,
}: Readonly<BrandingHeaderProps>) {
  return (
    <header
      className={cn(
        "flex items-center gap-4 border-b-[3px] border-[var(--sky)] bg-[linear-gradient(90deg,var(--ocean-700),var(--ocean)_55%,var(--header-end))] px-5",
        className,
      )}
      style={{ height: BRANDING_HEADER_HEIGHT }}
    >
      {/* Logo + brand text */}
      <button
        type="button"
        onClick={onLogoClick}
        className="flex min-w-0 shrink-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left"
      >
        <BrandLockup />
      </button>

      {/* Leading slot (e.g. sidebar toggle), right after the logo */}
      {leading && <div className="shrink-0">{leading}</div>}

      {title && <span className="font-semibold text-white">{title}</span>}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Trailing actions slot */}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
