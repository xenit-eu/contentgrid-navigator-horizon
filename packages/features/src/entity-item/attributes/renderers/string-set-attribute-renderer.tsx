import { Fragment } from "react";
import { AttributeValue, Chip } from "@contentgrid/ui";
import type { AttributeRendererVariant } from "./variant";

export interface StringSetAttributeRendererProps {
  readonly value: readonly string[] | null;
  readonly wrap?: boolean;
  /**
   * Hard-truncates text to this many characters (plus an ellipsis). In the `"attribute-table"`
   * variant it applies to each chip's text; otherwise to the comma-separated value.
   */
  readonly maxCharLength?: number;
  /**
   * - `"attribute-table"` (entity item detail page) — one chip per value, wrapping onto new rows
   *   as the available width runs out.
   * - anything else, including the collection `"table"` — comma-separated text.
   */
  readonly variant?: AttributeRendererVariant;
}

function truncate(text: string, maxCharLength: number | undefined): string {
  return maxCharLength != null && text.length > maxCharLength
    ? `${text.slice(0, maxCharLength)}…`
    : text;
}

export function StringSetAttributeRenderer({
  value,
  wrap = true,
  maxCharLength,
  variant = "default",
}: Readonly<StringSetAttributeRendererProps>) {
  if (value == null || value.length === 0) {
    return <AttributeValue wrap={wrap} />;
  }

  if (variant !== "attribute-table") {
    return <AttributeValue wrap={wrap}>{truncate(value.join(", "), maxCharLength)}</AttributeValue>;
  }

  // Chips are inline-level (inline-flex) inside a plain inline-flow container, not a flex
  // container: flex items are blockified, which would make a copy put each value on its own line.
  // Between chips sits a visually hidden ", " so selecting and copying the cell yields a list.
  // `whitespace-normal` undoes the `whitespace-nowrap` that table cells set, so the chips wrap onto
  // a new row when the cell runs out of width.
  return (
    <span
      data-slot="string-set-chips"
      className={`block min-w-0 leading-7 ${wrap ? "whitespace-normal" : "overflow-hidden whitespace-nowrap"}`}
    >
      {value.map((item, index) => {
        const label = truncate(item, maxCharLength);
        return (
          // Values in a set are unique, but the index keeps keys stable if the server ever repeats one.
          <Fragment key={`${index}:${item}`}>
            {index > 0 && <span className="sr-only">, </span>}
            <Chip
              label={label}
              // Chip's own tooltip shows the (truncated) label; expose the full text when it was cut.
              description={label === item ? undefined : item}
              className="mr-1 align-middle"
            />
          </Fragment>
        );
      })}
    </span>
  );
}
