import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { AttributeValue, TruncatedText } from "@contentgrid/ui";

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
  const text = value == null ? "" : String(value);
  return (
    <AttributeValue wrap={wrap}>
      {text && <TruncatedText text={text} maxCharLength={maxCharLength} />}
    </AttributeValue>
  );
}
