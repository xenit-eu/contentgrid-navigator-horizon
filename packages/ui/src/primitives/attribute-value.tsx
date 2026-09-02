import type * as React from "react";
import { cn } from "../lib/utils";

interface AttributeValueProps {
  readonly children?: React.ReactNode;
  readonly emptyText?: string;
  readonly variant?: "default" | "numeric";
  /** Wrap onto multiple lines instead of the default single-line ellipsis truncation. */
  readonly wrap?: boolean;
  readonly className?: string;
}

function AttributeValue({
  children,
  emptyText = "—",
  variant = "default",
  wrap = false,
  className,
}: AttributeValueProps) {
  const isEmpty = children == null || children === "";
  return (
    <span
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
