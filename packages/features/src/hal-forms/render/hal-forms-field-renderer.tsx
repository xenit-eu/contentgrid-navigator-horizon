import { memo } from "react";
import type { ReactNode } from "react";
import type { FieldValue } from "@contentgrid/navigator-data";
import {
  AutocompleteRenderer,
  BooleanRenderer,
  DateTimeRenderer,
  EnumMultiRenderer,
  EnumRenderer,
  NumberRenderer,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ProvenanceTag,
  TextRenderer,
} from "@contentgrid/ui";
import type { HalFormsField } from "../model/hal-forms-field";
import type { FieldState } from "../state/field-error";
import {
  asBoolean,
  asDateOrString,
  asNumberOrString,
  asString,
  asStringArray,
} from "./narrow-field-value";

export interface HalFormsFieldRendererProps {
  readonly field: HalFormsField;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly fieldState?: FieldState;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Dispatches a `HalFormsField` to its renderer — generalizes `entity-item-create`'s
 * `FieldRenderer` (ADR-004) to this feature's field union. `file` renders as an inert
 * placeholder; `autocomplete` does too until `fieldState.autocomplete` is supplied.
 *
 * Deliberately fetches nothing itself — `autocomplete`'s suggestions come from
 * `fieldState.autocomplete`, supplied by whichever caller has the profile/template context to
 * run `useTypeahead` (`@contentgrid/navigator-data`). This mirrors `packages/ui`'s own
 * `AutocompleteRenderer` (plain scalar props, no fetching) one layer up: the render layer stays
 * purely presentational regardless of whether it's rendering a create form or a search form: the
 * search page owns its `useTypeahead` call (exactly as `entity-item-collection-view.tsx` already
 * does today) and passes the live results in, rather than this generic renderer reaching out to
 * fetch them itself.
 *
 * Wrapped in `memo` for the same reason as the original: `HalFormsContainer` gives every field a
 * referentially stable `onChange`/`onFocus`/`onBlur`, so one field's keystroke doesn't re-render
 * every sibling's widget.
 */
export const HalFormsFieldRenderer = memo(function HalFormsFieldRenderer({
  field,
  value,
  onChange,
  fieldState,
  onFocus,
  onBlur,
}: Readonly<HalFormsFieldRendererProps>) {
  return (
    <div className="relative">
      {renderFieldWidget({ field, value, onChange, fieldState, onFocus, onBlur })}
      {fieldState?.provenance !== undefined && (
        <ProvenanceIndicator label={field.label} provenance={fieldState.provenance} />
      )}
    </div>
  );
});

/**
 * FR-013/FR-014: a clickable indicator, bottom-left of its field, opening a popover with the
 * same caller-supplied content. Absent entirely when there's no provenance to show — see
 * `HalFormsFieldRendererProps.fieldState`'s doc comment for why this reads off `fieldState`, not
 * off `field` itself.
 *
 * The trigger reuses this product's existing `ProvenanceTag` pattern (the exact chip the "the
 * provenance tags will also be clickable with a popover" requirement names) rather than a
 * bespoke label — `kind="modified"` is a reasonable generic default since this indicator has no
 * classification signal of its own; the caller-supplied `provenance` content underneath it is
 * where the real, specific detail (who/what/when) lives.
 */
function ProvenanceIndicator({
  label,
  provenance,
}: Readonly<{ label: string; provenance: ReactNode }>) {
  return (
    <Popover>
      <PopoverTrigger type="button" aria-label={`Show provenance for ${label}`} className="mt-1">
        <ProvenanceTag kind="modified" />
      </PopoverTrigger>
      <PopoverContent align="start">{provenance}</PopoverContent>
    </Popover>
  );
}

function renderFieldWidget({
  field,
  value,
  onChange,
  fieldState,
  onFocus,
  onBlur,
}: Readonly<HalFormsFieldRendererProps>) {
  const error = fieldState?.errors.map((fieldError) => fieldError.message).join(" ") || undefined;

  switch (field.kind) {
    case "text":
      return (
        <TextRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          regex={field.regex}
          maxLength={field.maxLength}
          format={field.format}
          value={asString(value)}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    case "number":
      return (
        <NumberRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          hideLabel={field.hideLabel}
          value={asNumberOrString(value)}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    case "boolean":
      return (
        <BooleanRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          value={asBoolean(value)}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    case "datetime":
      return (
        <DateTimeRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          hideLabel={field.hideLabel}
          includesTime={field.includesTime}
          value={asDateOrString(value)}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    case "enum": {
      const isRemote = field.property.options?.isRemote() ?? false;
      return field.multiValue ? (
        <EnumMultiRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          options={field.options}
          isRemote={isRemote}
          value={asStringArray(value)}
          onChange={onChange}
          error={error}
        />
      ) : (
        <EnumRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          options={field.options}
          isRemote={isRemote}
          value={asString(value)}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    }
    case "autocomplete": {
      const autocomplete = fieldState?.autocomplete;
      if (!autocomplete) return <UnsupportedFieldPlaceholder field={field} />;
      return (
        <AutocompleteRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          value={asString(value)}
          onChange={onChange}
          error={error}
          suggestions={autocomplete.suggestions}
          isLoading={autocomplete.isLoading}
          onQueryChange={autocomplete.onQueryChange}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    }
    case "file":
      return <UnsupportedFieldPlaceholder field={field} />;
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}

function UnsupportedFieldPlaceholder({ field }: Readonly<{ field: HalFormsField }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{field.label}</p>
      <p className="text-sm text-muted-foreground">
        This field type (&quot;{field.kind}&quot;) is not yet supported in this form.
      </p>
    </div>
  );
}
