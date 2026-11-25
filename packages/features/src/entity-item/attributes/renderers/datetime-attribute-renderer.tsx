import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";
import { formatAbsoluteDate } from "./format-date-value";

export interface DateTimeAttributeRendererProps {
  readonly value: string | null;
  readonly wrap?: boolean;
}

export function DateTimeAttributeRenderer({
  value,
  wrap,
}: Readonly<DateTimeAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  return (
    <AttributeValue wrap={wrap}>
      {formatAbsoluteDate(parsed, ProfileAttributeType.datetime)}
    </AttributeValue>
  );
}
