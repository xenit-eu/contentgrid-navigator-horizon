import * as React from "react";
import { cn } from "../../lib/utils";
import { Separator } from "../../primitives/separator";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BrandingHeaderProps {
  /** Application / tenant name shown as the primary heading */
  title: string;
  /** Optional tagline or secondary line below the title */
  subtitle?: string;
  /**
   * URL of the logo image. When provided the image is displayed to the left
   * of the title. When omitted the title is shown without an icon.
   */
  logoUrl?: string;
  /** Alt text for the logo image; defaults to `"${title} logo"` */
  logoAlt?: string;
  /**
   * Optional slot for actions rendered at the trailing end of the header
   * (e.g. a user-menu button, theme toggle, or notification icon).
   */
  actions?: React.ReactNode;
  /** Extra class names applied to the root <header> element */
  className?: string;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BrandingHeader({
  title,
  subtitle,
  logoUrl,
  logoAlt,
  actions,
  className,
}: BrandingHeaderProps) {
  return (
    <header className={cn("flex h-14 items-center gap-3 border-b bg-background px-4", className)}>
      {/* Logo */}
      {logoUrl && (
        <>
          <img
            src={logoUrl}
            alt={logoAlt ?? `${title} logo`}
            className="h-8 w-8 shrink-0 rounded object-contain"
          />
          <Separator orientation="vertical" className="h-6" />
        </>
      )}

      {/* Brand text */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold leading-none">{title}</span>
        {subtitle && (
          <span className="truncate text-xs text-muted-foreground leading-none mt-0.5">
            {subtitle}
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Trailing actions slot */}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
