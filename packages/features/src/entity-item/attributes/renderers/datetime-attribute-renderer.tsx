import { CalendarIcon } from "@phosphor-icons/react";
import { AttributeValue } from "@contentgrid/ui";

export interface DateTimeAttributeRendererProps {
  readonly value: string | null;
}

export function DateTimeAttributeRenderer({ value }: Readonly<DateTimeAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);

  return (
    <span className="flex items-center gap-1.5">
      <CalendarIcon size={14} className="text-muted-foreground" aria-hidden />
      <AttributeValue>{formatted}</AttributeValue>
    </span>
  );
}
