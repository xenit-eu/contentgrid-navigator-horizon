import { CalendarIcon } from "@phosphor-icons/react";
import { AttributeValue } from "@contentgrid/ui";
import { formatRelativeOrAbsoluteDate } from "./format-relative-date";

export interface CreatedDateAttributeRendererProps {
  readonly value: string | null;
}

export function CreatedDateAttributeRenderer({
  value,
}: Readonly<CreatedDateAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  return (
    <span className="flex items-center gap-1.5">
      <CalendarIcon size={14} className="text-muted-foreground" aria-hidden />
      <AttributeValue>{`created ${formatRelativeOrAbsoluteDate(parsed)}`}</AttributeValue>
    </span>
  );
}
