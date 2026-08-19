import * as React from "react";
import contentGridLogo from "../../assets/icons/ContentgridLogo-07.svg";
import { cn } from "../../lib/utils";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BrandingHeaderProps {
  /**
   * Optional slot for actions rendered at the trailing end of the header
   * (e.g. a user-menu button, theme toggle, or notification icon).
   */
  actions?: React.ReactNode;
  /** Extra class names applied to the root <header> element */
  className?: string;
  /** Called when the logo or brand text is clicked (e.g. to navigate home) */
  onLogoClick?: () => void;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BrandingHeader({ actions, className, onLogoClick }: Readonly<BrandingHeaderProps>) {
  return (
    <header className={cn("flex flex-col", className)}>
      {/* Content row */}
      <div className="flex h-14 items-center gap-2 bg-gradient-to-r from-[var(--ocean-700)] to-[var(--sky)] px-4">
        {/* Logo + brand text */}
        <button
          type="button"
          onClick={onLogoClick}
          className="flex min-w-0 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
        >
          <img
            src={contentGridLogo}
            alt="ContentGrid logo"
            className="w-12 shrink-0 object-contain"
          />
          <div className="truncate flex min-w-0 flex-col justify-center -translate-y-0.5">
            <div className="leading-none">
              <span className="truncate text-lg font-bold text-[var(--sky)]">content</span>
              <span className="truncate text-lg font-bold text-white">grid</span>
            </div>
            <span className="truncate font-semibold text-[8px] tracking-[3px] text-white/80 leading-none">
              BY AMEXIO
            </span>
          </div>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Trailing actions slot */}
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {/* Accent line */}
      <div className="h-1 bg-[var(--breeze)]" />
    </header>
  );
}
