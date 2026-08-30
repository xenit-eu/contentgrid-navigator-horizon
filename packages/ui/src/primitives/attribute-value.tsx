import type * as React from "react";
import { cn } from "../lib/utils";

interface AttributeValueProps {
  readonly children?: React.ReactNode;
  readonly emptyText?: string;
  readonly variant?: "default" | "numeric";
  readonly className?: string;
}

function AttributeValue({
  children,
  emptyText = "—",
  variant = "default",
  className,
}: AttributeValueProps) {
  const isEmpty = children == null || children === "";
  return (
    <span
      data-slot="attribute-value"
      className={cn(
        "block truncate text-sm",
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
