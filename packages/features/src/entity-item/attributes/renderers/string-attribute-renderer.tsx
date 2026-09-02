import { AttributeValue } from "@contentgrid/ui";

export interface StringAttributeRendererProps {
  readonly value: string | number | boolean | null;
}

export function StringAttributeRenderer({ value }: Readonly<StringAttributeRendererProps>) {
  return <AttributeValue wrap>{value == null ? undefined : String(value)}</AttributeValue>;
}
