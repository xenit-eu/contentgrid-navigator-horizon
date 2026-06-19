import { X } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface ChipProps {
  tone?: "neutral" | "applied";
  field?: string;
  label: string;
  removable?: boolean;
  onRemove?: () => void;
  className?: string;
}

function Chip({ tone = "neutral", field, label, removable, onRemove, className }: ChipProps) {
  return (
    <span
      data-slot="chip"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[6px] border text-[12px] font-medium",
        removable ? "py-1 pl-[10px] pr-[5px]" : "py-1 px-[10px]",
        tone === "applied"
          ? "bg-[#E2F3FD] border-[#C4E6F9] text-foreground dark:bg-[rgba(90,196,242,0.16)] dark:border-[#2C5A78]"
          : "bg-[#FAFDFF] border-[#E3EAF0] text-foreground dark:bg-[#13314A] dark:border-[#335269]",
        className,
      )}
    >
      {field && <span className="text-[#557891] dark:text-[#9FC4D8] font-normal">{field}: </span>}
      {label}
      {removable && (
        <button
          type="button"
          aria-label={`Remove ${label} filter`}
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent flex items-center"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </span>
  );
}

export { Chip };
