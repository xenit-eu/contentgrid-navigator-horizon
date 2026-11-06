import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { AttributeValue } from "@contentgrid/ui";

export interface StringAttributeRendererProps {
  readonly value: PlainAttributeValue;
  readonly wrap?: boolean;
  /** Hard-truncates the value to this many characters (plus an ellipsis) before rendering. */
  readonly maxCharLength?: number;
}

export function StringAttributeRenderer({
  value,
  wrap = true,
  maxCharLength,
}: Readonly<StringAttributeRendererProps>) {
  const text = value == null ? undefined : String(value);
  const truncated =
    text != null && maxCharLength != null && text.length > maxCharLength
      ? `${text.slice(0, maxCharLength)}…`
      : text;
  return <AttributeValue wrap={wrap}>{truncated}</AttributeValue>;
}
