import { AttributeValue } from "@contentgrid/ui";

export interface StringAttributeRendererProps {
  readonly value: string | number | boolean | null;
  readonly wrap?: boolean;
}

export function StringAttributeRenderer({
  value,
  wrap = true,
}: Readonly<StringAttributeRendererProps>) {
  return <AttributeValue wrap={wrap}>{value == null ? undefined : String(value)}</AttributeValue>;
}
