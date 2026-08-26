import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { BooleanRenderer } from "./boolean-renderer";
import { DateTimeRenderer } from "./datetime-renderer";
import { EnumMultiRenderer } from "./enum-multi-renderer";
import { EnumRenderer } from "./enum-renderer";
import { NumberRenderer } from "./number-renderer";
import { TextRenderer } from "./text-renderer";

export interface FieldRendererProps {
  readonly field: RenderFieldDescriptor;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

/**
 * Dispatches a `RenderFieldDescriptor` to its renderer (ADR-004's "RenderFieldDescriptor
 * switch" in place of a JSONForms-style tester/rank registry).
 *
 * `file`, `relation-to-one`, and `relation-to-many` variants do occur on real
 * create-forms but are covered by other tickets — rendered as an inert
 * placeholder here rather than crashing the form. `typeahead` never arises from
 * `createFormToRenderFields` (see create-form-to-render-fields.ts's own scope
 * note) — the `never` check below is a compile-time exhaustiveness guard for
 * the day a bridge produces it, not a real runtime path today.
 */
export function FieldRenderer({ field, value, onChange, error }: Readonly<FieldRendererProps>) {
  switch (field.type) {
    case "text":
      return <TextRenderer field={field} value={value} onChange={onChange} error={error} />;
    case "number":
      return <NumberRenderer field={field} value={value} onChange={onChange} error={error} />;
    case "boolean":
      return <BooleanRenderer field={field} value={value} onChange={onChange} error={error} />;
    case "datetime":
      return <DateTimeRenderer field={field} value={value} onChange={onChange} error={error} />;
    case "enum":
      return <EnumRenderer field={field} value={value} onChange={onChange} error={error} />;
    case "enum-multi":
      return <EnumMultiRenderer field={field} value={value} onChange={onChange} error={error} />;
    case "file":
    case "relation-to-one":
    case "relation-to-many":
    case "typeahead":
      return <UnsupportedFieldPlaceholder field={field} />;
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

function UnsupportedFieldPlaceholder({ field }: Readonly<{ field: RenderFieldDescriptor }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{field.label}</p>
      <p className="text-sm text-muted-foreground">
        This field type (&quot;{field.type}&quot;) is not yet supported in this form.
      </p>
    </div>
  );
}
