import type { ReactNode } from "react";
import { XIcon as X } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface ChipProps {
  /**
   * `neutral` (outline), `applied` (an active filter) or `warning` (orange, e.g. a filter that is
   * not applied). Colour is never the only signal — pair `warning` with an icon and a
   * `description`.
   */
  readonly tone?: "neutral" | "applied" | "warning";
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
  /** Extra explanation, e.g. why a filter is not applied: a tooltip, and read by screen readers. */
  readonly description?: string;
  readonly removable?: boolean;
  readonly onRemove?: () => void;
  /** Accessible name of the remove button; defaults to `Remove ${field} ${label} filter`. */
  readonly removeLabel?: string;
  /**
   * Makes the chip's body (field, mode and value) a button, e.g. to edit the filter. The remove
   * button stays a separate sibling control.
   */
  readonly onClick?: () => void;
  /** Accessible name of the body button; defaults to its visible text. */
  readonly clickLabel?: string;
  readonly className?: string;
}

// Warning matches StatusPill's "warning" variant (status-pill.tsx).
const TONE_CLASSES: Record<NonNullable<ChipProps["tone"]>, string> = {
  neutral: "border-border bg-background",
  applied: "border-ring/40 bg-accent",
  warning:
    "border-[rgba(212,104,42,0.45)] bg-[rgba(212,104,42,0.12)] text-[#A4501F] dark:border-[rgba(232,154,99,0.5)] dark:bg-[rgba(232,154,99,0.18)] dark:text-[#E89A63]",
};

function Chip({
  tone = "neutral",
  field,
  mode,
  modeIcon,
  label,
  valueIcon,
  description,
  removable,
  onRemove,
  removeLabel,
  onClick,
  clickLabel,
  className,
}: ChipProps) {
  const isWarning = tone === "warning";
  const body = (
    <>
      {field && (
        <span
          className={cn(
            "shrink-0 font-normal",
            isWarning ? "text-inherit" : "text-muted-foreground",
          )}
        >
          {field}:{" "}
        </span>
      )}
      {mode && (
        <span
          data-slot="chip-mode"
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-foreground/5 px-1 text-[11px] font-normal",
            isWarning ? "text-inherit" : "text-foreground",
          )}
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
      {description && <span className="sr-only">{description}</span>}
    </>
  );
  return (
    <span
      data-slot="chip"
      data-tone={tone}
      title={description}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-[6px] border text-[12px] font-medium text-foreground",
        removable ? "py-1 pr-[5px] pl-[10px]" : "px-[10px] py-1",
        TONE_CLASSES[tone],
        onClick && "has-[[data-slot=chip-body]:hover]:border-ring",
        className,
      )}
    >
      {onClick ? (
        <button
          type="button"
          data-slot="chip-body"
          aria-label={clickLabel}
          onClick={onClick}
          className="inline-flex min-w-0 items-center gap-1.5 rounded-sm border-0 bg-transparent p-0 text-inherit outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {body}
        </button>
      ) : (
        body
      )}
      {removable && (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${field ? `${field} ` : ""}${label} filter`}
          onClick={onRemove}
          className="flex shrink-0 items-center rounded-sm border-0 bg-transparent p-0 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X size={13} aria-hidden />
        </button>
      )}
    </span>
  );
}

export { Chip };
export type { ChipProps };
