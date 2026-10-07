import type { ReactNode } from "react";
import { XIcon as X } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface ChipProps {
  readonly tone?: "neutral" | "applied";
  readonly field?: string;
  /**
   * How the value is matched, e.g. "starts with", "after", "≥". Rendered as its own segment
   * between field and value, and never truncated before the value.
   */
  readonly mode?: string;
  readonly modeIcon?: ReactNode;
  /** The value. */
  readonly label: string;
  readonly valueIcon?: ReactNode;
  readonly removable?: boolean;
  readonly onRemove?: () => void;
  /** Accessible name of the remove button; defaults to `Remove ${field} ${label} filter`. */
  readonly removeLabel?: string;
  readonly className?: string;
}

function Chip({
  tone = "neutral",
  field,
  mode,
  modeIcon,
  label,
  valueIcon,
  removable,
  onRemove,
  removeLabel,
  className,
}: ChipProps) {
  return (
    <span
      data-slot="chip"
      data-tone={tone}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-[6px] border text-[12px] font-medium text-foreground",
        removable ? "py-1 pr-[5px] pl-[10px]" : "px-[10px] py-1",
        tone === "applied" ? "border-ring/40 bg-accent" : "border-border bg-background",
        className,
      )}
    >
      {field && <span className="shrink-0 font-normal text-muted-foreground">{field}: </span>}
      {mode && (
        <span
          data-slot="chip-mode"
          className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-foreground/5 px-1 text-[11px] font-normal text-foreground"
        >
          {modeIcon}
          {mode}
        </span>
      )}
      <span className="inline-flex min-w-0 items-center gap-1">
        {valueIcon}
        <span className="truncate" title={label}>
          {label}
        </span>
      </span>
      {removable && (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${field ? `${field} ` : ""}${label} filter`}
          onClick={onRemove}
          className="flex shrink-0 cursor-pointer items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </span>
  );
}

export { Chip };
export type { ChipProps };
