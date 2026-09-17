import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "../lib/utils";

const countIndicatorChipVariants = cva(
  "inline-flex items-center justify-center rounded-[6px] px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border border-border text-foreground",
        solid: "border border-[var(--steel)] bg-secondary text-secondary-foreground",
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
  className?: string;
}

function CountIndicatorChip({
  count,
  isEstimated = false,
  variant = "default",
  className,
}: Readonly<CountIndicatorChipProps>) {
  const label = count === null ? "?" : `${count.toLocaleString()}${isEstimated ? "~" : ""}`;

  return (
    <span
      data-slot="count-indicator-chip"
      data-variant={variant}
      className={cn(
        countIndicatorChipVariants({ variant }),
        count === 0 && "border-dashed opacity-60",
        className,
      )}
    >
      {label}
    </span>
  );
}

export { CountIndicatorChip, countIndicatorChipVariants };
