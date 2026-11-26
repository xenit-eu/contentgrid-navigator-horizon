import type { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";
import { formatAbsoluteDate } from "./format-date-value";

export interface AbsoluteDateAttributeRendererProps {
  readonly value: string | null;
  readonly wrap?: boolean;
  readonly type?: ProfileAttributeType.date | ProfileAttributeType.datetime;
}

export function AbsoluteDateAttributeRenderer({
  value,
  wrap,
  type,
}: Readonly<AbsoluteDateAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  return <AttributeValue wrap={wrap}>{formatAbsoluteDate(parsed, type)}</AttributeValue>;
}
