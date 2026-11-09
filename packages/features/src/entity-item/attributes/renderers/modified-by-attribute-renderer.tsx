import { UserIcon } from "@phosphor-icons/react";
import { AttributeValue, StatusPill } from "@contentgrid/ui";

export interface ModifiedByAttributeRendererProps {
  readonly value: string | number | boolean | null;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: "default" | "item-reference" | "table";
}

export function ModifiedByAttributeRenderer({
  value,
  label,
  wrap,
  variant = "default",
}: Readonly<ModifiedByAttributeRendererProps>) {
  const displayValue = value == null ? undefined : String(value);

  if (variant === "table") {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <UserIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden />
        <AttributeValue wrap={wrap}>{displayValue}</AttributeValue>
      </span>
    );
  }

  const pillLabel =
    variant === "item-reference" ? (displayValue ?? "—") : `${label}: ${displayValue ?? "—"}`;
  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={pillLabel}
      className={wrap ? "text-xs whitespace-normal break-words" : "text-xs"}
    />
  );
}
