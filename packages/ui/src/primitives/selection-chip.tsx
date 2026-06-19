import { cn } from "../lib/utils";

interface SelectionChipProps {
  selected?: boolean;
  label: string;
  onClick?: () => void;
  className?: string;
}

function SelectionChip({ selected = false, label, onClick, className }: SelectionChipProps) {
  return (
    <button
      type="button"
      data-slot="selection-chip"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-[14px] py-[7px] rounded-[8px] text-[13px] whitespace-nowrap cursor-pointer border transition-colors",
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
