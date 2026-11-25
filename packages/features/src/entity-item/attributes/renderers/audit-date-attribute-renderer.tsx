import type { Icon } from "@phosphor-icons/react";
import type { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";
import { AbsoluteDateAttributeRenderer } from "./absolute-date-attribute-renderer";
import { formatRelativeOrAbsoluteDate } from "./format-relative-date";
import { type AttributeRendererVariant, isTableVariant } from "./variant";

export interface AuditDateAttributeRendererProps {
  readonly value: string | null;
  readonly label: string;
  readonly icon: Icon;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
  readonly type?: ProfileAttributeType.date | ProfileAttributeType.datetime;
}

export function AuditDateAttributeRenderer({
  value,
  label,
  icon: IconComponent,
  wrap,
  variant = "default",
  type,
}: Readonly<AuditDateAttributeRendererProps>) {
  const parsed = value == null ? null : new Date(value);

  // Empty, unparseable and table values render exactly like a plain absolute date.
  if (parsed == null || Number.isNaN(parsed.getTime()) || isTableVariant(variant)) {
    return <AbsoluteDateAttributeRenderer value={value} wrap={wrap} type={type} />;
  }

  const text =
    variant === "item-reference"
      ? formatRelativeOrAbsoluteDate(parsed)
      : `${label}: ${formatRelativeOrAbsoluteDate(parsed)}`;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <IconComponent size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      <AttributeValue wrap={wrap}>{text}</AttributeValue>
    </span>
  );
}
