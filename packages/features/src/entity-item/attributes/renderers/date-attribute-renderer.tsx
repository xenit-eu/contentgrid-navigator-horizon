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
    <AttributeValue wrap={wrap}>
      {formatAbsoluteDate(parsed, ProfileAttributeType.date)}
    </AttributeValue>
  );
}
