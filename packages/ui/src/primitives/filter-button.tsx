import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { CaretDownIcon, XIcon } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

type FilterButtonTone = "idle" | "active" | "positive" | "negative";

interface FilterButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  readonly icon?: ReactNode;
  readonly label: string;
  /**
   * Outline colour: `idle` (no outline, no filter), `active` (blue, a filter is set), `positive`
   * (green) and `negative` (red) for a two-valued filter such as a boolean. Colour is never the
   * only signal — pair it with an icon or label that reflects the state.
   */
  readonly tone?: FilterButtonTone;
  /** Shows a ▾ after the label, hinting at a popover; turn it off for a toggle (e.g. a boolean). */
  readonly showChevron?: boolean;
  /** When set and `tone` is not `idle`, a separate × button clears the filter. */
  readonly onClear?: () => void;
  /** Accessible name of the × button; defaults to `Clear ${label} filter`. */
  readonly clearLabel?: string;
  /** Forwarded to the trigger button, so this works as `<PopoverTrigger asChild>`. */
  readonly ref?: Ref<HTMLButtonElement>;
}

const TONE_CLASSES: Record<FilterButtonTone, string> = {
  idle: "border-transparent text-muted-foreground hover:text-foreground",
  active: "border-ring bg-accent text-accent-foreground",
  positive: "border-success-foreground bg-success text-success-foreground",
  negative: "border-destructive bg-destructive/10 text-destructive",
};

/**
 * A compact filter trigger: icon + label, with an optional × that clears the filter. Idle it
 * reads as plain text (transparent border, so the size does not shift); once a filter is set it
 * gets a coloured outline. The × is a sibling button, not nested in the trigger, so both stay valid,
 * separately focusable controls. All other props (including those a Radix `asChild` trigger
 * injects, like `onClick`, `aria-expanded` and `ref`) go to the trigger button.
 */
function FilterButton({
  icon,
  label,
  tone = "idle",
  showChevron = true,
  onClear,
  clearLabel,
  className,
  ref,
  type = "button",
  ...triggerProps
}: FilterButtonProps) {
  const showClear = onClear !== undefined && tone !== "idle";
  return (
    <span
      data-slot="filter-button"
      data-tone={tone}
      className={cn(
        "inline-flex h-8 shrink-0 items-stretch overflow-hidden rounded-md border text-sm font-medium transition-colors",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap px-2.5 outline-none hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
          showClear ? "pr-1.5" : undefined,
        )}
        {...triggerProps}
      >
        {icon}
        {label}
        {showChevron && <CaretDownIcon size={12} aria-hidden className="opacity-60" />}
      </button>
      {showClear && (
        <button
          type="button"
          aria-label={clearLabel ?? `Clear ${label} filter`}
          onClick={onClear}
          className="inline-flex cursor-pointer items-center px-1.5 outline-none hover:bg-foreground/10 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <XIcon size={13} aria-hidden />
        </button>
      )}
    </span>
  );
}

export { FilterButton };
export type { FilterButtonProps, FilterButtonTone };
