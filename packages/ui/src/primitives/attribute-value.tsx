import type * as React from "react";
import { cn } from "../lib/utils";

/** Any other `<span>` prop is passed on, so the value can be e.g. a tooltip trigger. */
interface AttributeValueProps extends React.ComponentProps<"span"> {
  readonly emptyText?: string;
  readonly variant?: "default" | "numeric";
  /** Wrap onto multiple lines instead of the default single-line ellipsis truncation. */
  readonly wrap?: boolean;
}

function AttributeValue({
  children,
  emptyText = "—",
  variant = "default",
  wrap = false,
  className,
  ...props
}: AttributeValueProps) {
  const isEmpty = children == null || children === "";
  return (
    <span
      {...props}
      data-slot="attribute-value"
      className={cn(
        "block text-sm",
        wrap ? "whitespace-normal break-words" : "truncate",
        variant === "numeric" && "tabular-nums",
        isEmpty && "text-muted-foreground",
        className,
      )}
    >
      {isEmpty ? emptyText : children}
    </span>
  );
}

export { AttributeValue };
