import { UserIcon } from "@phosphor-icons/react";
import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { AttributeValue, StatusPill } from "@contentgrid/ui";
import { type AttributeRendererVariant, isTableVariant } from "./variant";

export interface AuditUserAttributeRendererProps {
  readonly value: PlainAttributeValue;
  readonly label: string;
  readonly pillClassName?: string;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
}

export function AuditUserAttributeRenderer({
  value,
  label,
  pillClassName,
  wrap,
  variant = "default",
}: Readonly<AuditUserAttributeRendererProps>) {
  const displayValue = value == null ? undefined : String(value);

  if (isTableVariant(variant)) {
    return <AttributeValue wrap={wrap}>{displayValue}</AttributeValue>;
  }

  const pillLabel =
    variant === "item-reference" ? (displayValue ?? "—") : `${label}: ${displayValue ?? "—"}`;
  const className = [pillClassName, wrap ? "whitespace-normal break-words" : undefined]
    .filter(Boolean)
    .join(" ");
  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={pillLabel}
      className={className || undefined}
    />
  );
}
