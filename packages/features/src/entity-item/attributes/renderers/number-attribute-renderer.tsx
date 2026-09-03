import { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";

export interface NumberAttributeRendererProps {
  readonly value: number | null;
  readonly type: ProfileAttributeType.long | ProfileAttributeType.double;
}

export function NumberAttributeRenderer({ value, type }: Readonly<NumberAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue variant="numeric" />;
  }
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: type === ProfileAttributeType.long ? 0 : 6,
  }).format(value);
  return <AttributeValue variant="numeric">{formatted}</AttributeValue>;
}
