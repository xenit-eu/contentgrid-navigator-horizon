import { cn } from "../lib/utils";

interface SelectionChipProps {
  readonly selected?: boolean;
  readonly label: string;
  readonly onClick?: () => void;
  readonly className?: string;
  readonly size?: "default" | "sm";
}

function SelectionChip({
  selected = false,
  label,
  onClick,
  className,
  size = "default",
}: SelectionChipProps) {
  return (
    <button
      type="button"
      data-slot="selection-chip"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center whitespace-nowrap cursor-pointer border transition-colors",
        size === "sm"
          ? "px-[10px] py-[5px] rounded-[6px] text-[13px]"
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
