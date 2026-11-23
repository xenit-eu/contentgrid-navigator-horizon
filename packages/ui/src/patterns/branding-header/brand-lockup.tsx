import contentGridLogoOnLight from "../../assets/icons/ContentgridLogo-blue-dark.svg";
import contentGridLogoOnDark from "../../assets/icons/ContentgridLogo-blue-white.svg";
import { cn } from "../../lib/utils";

export interface BrandLockupProps {
  /**
   * `on-dark` (default): white logo and text, for the dark page header. `on-light`: dark logo with
   * sky "content", ocean "grid" and ocean tagline, for surfaces that are white in light mode, such
   * as the phone drawer. In dark mode `on-light` switches to exactly the `on-dark` colours.
   */
  tone?: "on-dark" | "on-light";
}

/** The ContentGrid logo with the "contentgrid / BY AMEXIO" wordmark. */
export function BrandLockup({ tone = "on-dark" }: Readonly<BrandLockupProps>) {
  const onLight = tone === "on-light";
  return (
    <>
      {onLight && (
        // Light mode only: `dark:hidden` is display:none in dark mode, so exactly one logo is exposed.
        <img
          src={contentGridLogoOnLight}
          alt="ContentGrid logo"
          className="size-[30px] shrink-0 object-contain dark:hidden"
        />
      )}
      <img
        src={contentGridLogoOnDark}
        alt="ContentGrid logo"
        className={cn(
          "size-[30px] shrink-0 object-contain",
          // On a light surface the white logo only shows in dark mode (display:none otherwise).
          onLight && "hidden dark:block",
        )}
      />
      <span className="flex min-w-0 flex-col justify-center">
        <span
          className={cn(
            "text-[17px] leading-none font-bold tracking-[0.01em]",
            onLight ? "text-[var(--sky)] dark:text-white" : "text-white",
          )}
        >
          content
          <span
            className={
              onLight
                ? "text-primary dark:text-[var(--brand-accent)]"
                : "text-[var(--brand-accent)]"
            }
          >
            grid
          </span>
        </span>
        <span
          className={cn(
            "mt-0.5 text-[8px] leading-none font-semibold tracking-[0.22em]",
            onLight ? "text-primary dark:text-[var(--header-sub)]" : "text-[var(--header-sub)]",
          )}
        >
          BY AMEXIO
        </span>
      </span>
    </>
  );
}
