import type { KeyboardEvent, ReactNode, Ref } from "react";
import { cn } from "../lib/utils";

interface SelectionChipProps {
  readonly selected?: boolean;
  readonly label: string;
  readonly onClick?: () => void;
  readonly className?: string;
  readonly size?: "default" | "sm";
  readonly disabled?: boolean;
  /** `"radio"` for a chip in a pick-one group (exposes `aria-checked`, for use inside a
   *  `role="radiogroup"`); omitted, it's a toggle button (`aria-pressed`). */
  readonly role?: "radio";
  /** For a roving-tabindex group, where only one chip is in the tab order. */
  readonly tabIndex?: number;
  readonly onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  readonly ref?: Ref<HTMLButtonElement>;
  /** Leading icon, e.g. a type indicator. */
  readonly icon?: ReactNode;
  /** Trailing content after the label, e.g. a `CountIndicatorChip`. */
  readonly trailing?: ReactNode;
  readonly id?: string;
  /** Joins the chip to its neighbour into one control: `"start"` is the left chip, `"end"` the
   *  right one. */
  readonly joined?: "start" | "end";
}

function SelectionChip({
  selected = false,
  label,
  onClick,
  className,
  size = "default",
  disabled = false,
  role,
  tabIndex,
  onKeyDown,
  ref,
  icon,
  trailing,
  id,
  joined,
}: SelectionChipProps) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      data-slot="selection-chip"
      role={role}
      aria-pressed={role ? undefined : selected}
      aria-checked={role ? selected : undefined}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap border border-[#C5D6E2] dark:border-[#335269] transition-colors",
        disabled && "cursor-not-allowed opacity-50",
        size === "sm"
          ? "px-[10px] py-[5px] rounded-[6px] text-[12px]"
          : "px-[14px] py-[7px] rounded-[8px] text-[13px]",
        selected
          ? "bg-[var(--sky-extract)] dark:bg-[var(--dark-accent)] text-foreground font-semibold"
          : "bg-[#FAFDFF] dark:bg-[#13314A] text-[#0E2436] dark:text-[#EAF4FB] font-normal",
        // The focused chip sits on top, so its focus ring shows over the shared edge.
        joined && "relative focus-visible:z-10",
        joined === "start" && "rounded-r-none",
        joined === "end" && "-ml-px rounded-l-none",
        className,
      )}
    >
      {icon}
      {label}
      {trailing}
    </button>
  );
}

export { SelectionChip };
