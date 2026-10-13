import type { KeyboardEvent, Ref } from "react";
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
}: SelectionChipProps) {
  return (
    <button
      ref={ref}
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
        "inline-flex items-center whitespace-nowrap border transition-colors",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        size === "sm"
          ? "px-[10px] py-[5px] rounded-[6px] text-[12px]"
          : "px-[14px] py-[7px] rounded-[8px] text-[13px]",
        selected
          ? "bg-[#084772] dark:bg-[#1F9FE0] text-white dark:text-[#04202F] border-[#084772] dark:border-[#1F9FE0] font-semibold"
          : "bg-[#FAFDFF] dark:bg-[#13314A] text-[#0E2436] dark:text-[#EAF4FB] border-[#C5D6E2] dark:border-[#335269] font-normal",
        className,
      )}
    >
      {label}
    </button>
  );
}

export { SelectionChip };
