import { UserIcon } from "@phosphor-icons/react";
import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { AttributeValue, StatusPill } from "@contentgrid/ui";
import { type AttributeRendererVariant, isTableVariant } from "./variant";

export interface CreatedByAttributeRendererProps {
  readonly value: PlainAttributeValue;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
}

export function CreatedByAttributeRenderer({
  value,
  label,
  wrap,
  variant = "default",
}: Readonly<CreatedByAttributeRendererProps>) {
  const displayValue = value == null ? undefined : String(value);

  if (isTableVariant(variant)) {
    return <AttributeValue wrap={wrap}>{displayValue}</AttributeValue>;
  }

  const pillLabel =
    variant === "item-reference" ? (displayValue ?? "—") : `${label}: ${displayValue ?? "—"}`;
  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={pillLabel}
      className={wrap ? "whitespace-normal break-words" : undefined}
    />
  );
}
