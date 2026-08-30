import { CalendarIcon } from "@phosphor-icons/react";
import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";

export interface DateAttributeRendererProps {
  readonly value: string | null;
  readonly type: ProfileAttributeType.date | ProfileAttributeType.datetime;
}

export function DateAttributeRenderer({ value, type }: Readonly<DateAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  const formatted = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(type === ProfileAttributeType.datetime ? { timeStyle: "short" } : {}),
  }).format(parsed);

  return (
    <span className="flex items-center gap-1.5">
      <CalendarIcon size={14} className="text-muted-foreground" aria-hidden />
      <AttributeValue>{formatted}</AttributeValue>
    </span>
  );
}
