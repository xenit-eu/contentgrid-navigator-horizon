import { CalendarIcon } from "@phosphor-icons/react";
import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";
import { formatAbsoluteDate } from "./format-date-value";

export interface DateAttributeRendererProps {
  readonly value: string | null;
  readonly wrap?: boolean;
}

export function DateAttributeRenderer({ value, wrap }: Readonly<DateAttributeRendererProps>) {
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
      <AttributeValue wrap={wrap}>
        {formatAbsoluteDate(parsed, ProfileAttributeType.date)}
      </AttributeValue>
    </span>
  );
}
