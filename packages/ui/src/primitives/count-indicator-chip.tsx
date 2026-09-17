import { cn } from "../lib/utils";

export interface CountIndicatorChipProps {
  /** The count to display, or `null` when it is not yet known. */
  count: number | null;
  /** Whether `count` is an estimate rather than an exact total. */
  isEstimated?: boolean;
  className?: string;
}

function CountIndicatorChip({
  count,
  isEstimated = false,
  className,
}: Readonly<CountIndicatorChipProps>) {
  const label = count === null ? "?" : `${count.toLocaleString()}${isEstimated ? "~" : ""}`;

  return (
    <span
      data-slot="count-indicator-chip"
      className={cn(
        "inline-flex items-center justify-center rounded-[6px] border border-border px-1.5 py-0.5 text-xs font-medium text-foreground whitespace-nowrap",
        count === 0 && "border-dashed opacity-60",
        className,
      )}
    >
      {label}
    </span>
  );
}

export { CountIndicatorChip };
