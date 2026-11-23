import * as React from "react";
import contentGridLogo from "../../assets/icons/ContentgridLogo-blue-white.svg";
import { cn } from "../../lib/utils";

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
   * Optional slot rendered in place of the logo/brand text on narrow
   * (mobile) viewports — e.g. a sidebar toggle, so it isn't lost when the
   * sidebar itself collapses off-screen.
   */
  mobileLeading?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BrandingHeader({
  actions,
  className,
  title,
  onLogoClick,
  mobileLeading,
}: Readonly<BrandingHeaderProps>) {
  return (
    <header
      className={cn(
        "flex items-center gap-4 border-b-[3px] border-[var(--sky)] bg-[linear-gradient(90deg,var(--ocean-700),var(--ocean)_55%,var(--header-end))] px-5",
        className,
      )}
      style={{ height: BRANDING_HEADER_HEIGHT }}
    >
      {/* Mobile leading slot (e.g. sidebar toggle) — replaces the logo below md */}
      {mobileLeading && <div className="shrink-0 md:hidden">{mobileLeading}</div>}

      {/* Logo + brand text */}
      <button
        type="button"
        onClick={onLogoClick}
        className={cn(
          "flex min-w-0 shrink-0 items-center gap-2.5 border-0 bg-transparent p-0 text-left",
          mobileLeading && "hidden md:flex",
        )}
      >
        <img
          src={contentGridLogo}
          alt="ContentGrid logo"
          className="size-[30px] shrink-0 object-contain"
        />
        <span className="flex min-w-0 flex-col justify-center">
          <span className="text-[17px] leading-none font-bold tracking-[0.01em] text-white">
            content<span className="text-[var(--brand-accent)]">grid</span>
          </span>
          <span className="mt-0.5 text-[8px] leading-none font-semibold tracking-[0.22em] text-[var(--header-sub)]">
            BY AMEXIO
          </span>
        </span>
      </button>

      {title && <span className="font-semibold text-white">{title}</span>}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Trailing actions slot */}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
