import { CalendarIcon } from "@phosphor-icons/react";
import { AttributeValue } from "@contentgrid/ui";
import { formatRelativeOrAbsoluteDate } from "./format-relative-date";

export interface CreatedDateAttributeRendererProps {
  readonly value: string | null;
  readonly label: string;
  readonly wrap?: boolean;
}

export function CreatedDateAttributeRenderer({
  value,
  label,
  wrap,
}: Readonly<CreatedDateAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <CalendarIcon size={14} className="shrink-0 text-muted-foreground" aria-hidden />
      <AttributeValue
        wrap={wrap}
      >{`${label}: ${formatRelativeOrAbsoluteDate(parsed)}`}</AttributeValue>
    </span>
  );
}
