import contentGridLogoOnLight from "../../assets/icons/ContentgridLogo-blue-dark.svg";
import contentGridLogoOnDark from "../../assets/icons/ContentgridLogo-blue-white.svg";
import { cn } from "../../lib/utils";

export interface BrandLockupProps {
  /**
   * `on-dark` (default): white logo and text, for the dark page header. `on-light`: dark logo with
   * sky "content", ocean "grid" and ocean tagline, for white surfaces such as the phone drawer.
   */
  tone?: "on-dark" | "on-light";
}

/** The ContentGrid logo with the "contentgrid / BY AMEXIO" wordmark. */
export function BrandLockup({ tone = "on-dark" }: Readonly<BrandLockupProps>) {
  const onLight = tone === "on-light";
  return (
    <>
      <img
        src={onLight ? contentGridLogoOnLight : contentGridLogoOnDark}
        alt="ContentGrid logo"
        className="size-[30px] shrink-0 object-contain"
      />
      <span className="flex min-w-0 flex-col justify-center">
        <span
          className={cn(
            "text-[17px] leading-none font-bold tracking-[0.01em]",
            onLight ? "text-[var(--sky)]" : "text-white",
          )}
        >
          content
          <span className={onLight ? "text-primary" : "text-[var(--brand-accent)]"}>grid</span>
        </span>
        <span
          className={cn(
            "mt-0.5 text-[8px] leading-none font-semibold tracking-[0.22em]",
            onLight ? "text-primary" : "text-[var(--header-sub)]",
          )}
        >
          BY AMEXIO
        </span>
      </span>
    </>
  );
}
