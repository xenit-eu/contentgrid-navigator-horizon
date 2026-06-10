import * as React from "react";
import { LogomarkDiap } from "../../brand/logomark";
import { cn } from "../../lib/utils";
import { Separator } from "../../primitives/separator";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Visual treatment of the header bar.
 *
 * - `"light"` (default) — neutral `bg-background` bar with a bordered bottom
 *   edge. Backwards-compatible with the original BrandingHeader.
 * - `"ocean"` — the branded ContentGrid bar: 56px tall, gradient background
 *   (--cg-gradient-header), white text, the LogomarkDiap glyph and the
 *   "contentgrid" wordmark with a "BY AMEXIO" byline, and a 3px sky underline.
 */
export type BrandingHeaderVariant = "light" | "ocean";

export interface BrandingHeaderProps {
  /** Application / tenant name shown as the primary heading */
  title: string;
  /** Optional tagline or secondary line below the title */
  subtitle?: string;
  /**
   * URL of the logo image. When provided the image is displayed to the left
   * of the title. When omitted the title is shown without an icon.
   *
   * In the `"ocean"` variant, when no `logoUrl` is supplied the built-in
   * LogomarkDiap glyph is rendered instead.
   */
  logoUrl?: string;
  /** Alt text for the logo image; defaults to `"${title} logo"` */
  logoAlt?: string;
  /**
   * Optional slot for actions rendered at the trailing end of the header
   * (e.g. a user-menu button, theme toggle, or notification icon).
   */
  actions?: React.ReactNode;
  /** Visual treatment of the bar. Defaults to `"light"`. */
  variant?: BrandingHeaderVariant;
  /** Extra class names applied to the root <header> element */
  className?: string;
}

// ---------------------------------------------------------------------------
// Ocean variant
// ---------------------------------------------------------------------------

function OceanBrandingHeader({
  title,
  subtitle,
  logoUrl,
  logoAlt,
  actions,
  className,
}: Readonly<Omit<BrandingHeaderProps, "variant">>) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between gap-3 px-6 text-primary-foreground shadow-[inset_0_-3px_0_var(--cg-color-sky)]",
        className,
      )}
      style={{ background: "var(--cg-gradient-header)" }}
    >
      {/* Brand cluster: glyph + wordmark */}
      <div className="flex min-w-0 items-center gap-2.5">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={logoAlt ?? `${title} logo`}
            className="size-[38px] shrink-0 rounded-full object-contain"
          />
        ) : (
          <LogomarkDiap size={38} />
        )}

        <div className="flex min-w-0 flex-col leading-none">
          <span className="truncate text-[16px] font-bold leading-none tracking-[-0.01em] text-white">
            {title}
          </span>
          {subtitle && (
            <span
              className="mt-[3px] block truncate text-[9px] font-semibold"
              style={{ letterSpacing: "0.26em", color: "var(--cg-color-header-dim)" }}
            >
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Trailing actions slot */}
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Light variant (original)
// ---------------------------------------------------------------------------

function LightBrandingHeader({
  title,
  subtitle,
  logoUrl,
  logoAlt,
  actions,
  className,
}: Readonly<Omit<BrandingHeaderProps, "variant">>) {
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
          <span className="mt-0.5 truncate text-xs leading-none text-muted-foreground">
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

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function BrandingHeader({ variant = "light", ...props }: Readonly<BrandingHeaderProps>) {
  if (variant === "ocean") {
    return <OceanBrandingHeader {...props} />;
  }
  return <LightBrandingHeader {...props} />;
}
