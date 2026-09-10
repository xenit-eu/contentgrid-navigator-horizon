import { CalendarIcon } from "@phosphor-icons/react";
import type { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";
import { formatAbsoluteDate } from "./format-date-value";
import { formatRelativeOrAbsoluteDate } from "./format-relative-date";

export interface CreatedDateAttributeRendererProps {
  readonly value: string | null;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: "default" | "item-reference" | "table";
  readonly type?: ProfileAttributeType.date | ProfileAttributeType.datetime;
}

export function CreatedDateAttributeRenderer({
  value,
  label,
  wrap,
  variant = "default",
  type,
}: Readonly<CreatedDateAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  const text =
    variant === "table"
      ? formatAbsoluteDate(parsed, type)
      : `${label}: ${formatRelativeOrAbsoluteDate(parsed)}`;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <CalendarIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      <AttributeValue wrap={wrap}>{text}</AttributeValue>
    </span>
  );
}
