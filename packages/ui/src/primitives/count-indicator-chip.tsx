import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "../lib/utils";

const countIndicatorChipVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border border-border text-foreground",
        solid: "border border-border bg-[var(--ocean)] text-primary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface CountIndicatorChipProps extends VariantProps<typeof countIndicatorChipVariants> {
  /** The count to display, or `null` when it is not yet known. */
  count: number | null;
  /** Whether `count` is an estimate rather than an exact total. */
  isEstimated?: boolean;
  /** Shows a pulsing placeholder (and `aria-busy`) while the count is being fetched. */
  isLoading?: boolean;
  className?: string;
}

function CountIndicatorChip({
  count,
  isEstimated = false,
  isLoading = false,
  variant = "default",
  className,
}: Readonly<CountIndicatorChipProps>) {
  if (isLoading) {
    return (
      <span
        data-slot="count-indicator-chip"
        data-variant={variant}
        aria-busy="true"
        className={cn(countIndicatorChipVariants({ variant }), "animate-pulse", className)}
      >
        <span aria-hidden className="inline-block h-3 w-4 rounded-sm bg-muted-foreground/25" />
        <span className="sr-only">Loading count</span>
      </span>
    );
  }

  const label = count === null ? "?" : `${count.toLocaleString()}${isEstimated ? "~" : ""}`;
  const description =
    count === null
      ? "unknown number of results"
      : `${isEstimated ? "about " : ""}${count.toLocaleString()} ${count === 1 ? "result" : "results"}`;

  return (
    <span
      data-slot="count-indicator-chip"
      data-variant={variant}
      title={description}
      className={cn(
        countIndicatorChipVariants({ variant }),
        count === 0 && "border-dashed opacity-60",
        className,
      )}
    >
      <span aria-hidden>{label}</span>
      <span className="sr-only">{description}</span>
    </span>
  );
}

export { CountIndicatorChip, countIndicatorChipVariants };
