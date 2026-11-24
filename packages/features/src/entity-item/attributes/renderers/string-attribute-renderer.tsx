import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { TruncatedAttributeValue } from "./truncated-attribute-value";

export interface StringAttributeRendererProps {
  readonly value: PlainAttributeValue;
  readonly wrap?: boolean;
  /**
   * Hard-truncates the value to this many characters (plus an ellipsis) before rendering; the full
   * value then shows in a tooltip on hover.
   */
  readonly maxCharLength?: number;
}

export function StringAttributeRenderer({
  value,
  wrap = true,
  maxCharLength,
}: Readonly<StringAttributeRendererProps>) {
  const text = value == null ? undefined : String(value);
  return <TruncatedAttributeValue text={text} maxCharLength={maxCharLength} wrap={wrap} />;
}
