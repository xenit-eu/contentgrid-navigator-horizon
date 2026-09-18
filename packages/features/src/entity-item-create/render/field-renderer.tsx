import { memo } from "react";
import type { FieldValue } from "@contentgrid/navigator-data";
import {
  BooleanRenderer,
  DateTimeRenderer,
  EnumMultiRenderer,
  EnumRenderer,
  FileRenderer,
  NumberRenderer,
  TextRenderer,
} from "@contentgrid/ui";
import type { FieldDescriptor } from "../model/field-descriptor";
import type { FieldState } from "../state/field-state";

export interface FieldRendererProps {
  readonly field: FieldDescriptor;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly fieldState?: FieldState;
  /**
   * Forwarded straight to the underlying `packages/ui` widget's native input for the field kinds
   * that have exactly one focusable element (`text`, `number`, `boolean`, `datetime`, single-value
   * `enum`). Not supported for `enum` with `multiValue` (one checkbox per option) — that's a
   * composite widget with no single element a lone `onFocus`/`onBlur` pair could unambiguously
   * target.
   */
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Dispatches a `FieldDescriptor` to its renderer (ADR-004's `FieldRenderer` switch).
 *
 * `file` submits the picked `File` (or `[File]` for a `multiValue` property) as a plain form
 * value like any other field — no separate upload step. The server's create-form template
 * declares `multipart/form-data` whenever the entity has a content attribute, and the HAL-FORMS
 * codec (`profileEntity.createEntityItemRequest`) already encodes `Blob`/`File` values into that
 * multipart body — see `packages/ui/src/patterns/form-renderers/file-renderer.tsx`'s doc comment.
 * `filter` and `sort` are intentionally NOT cases here at all — see `model/field-descriptor.ts`'s
 * doc comment for why they're kept out of the `FieldDescriptor` union entirely rather than routed
 * through this per-field switch. The `never` check in `default` is a compile-time exhaustiveness
 * guard, not a real runtime path today.
 *
 * Wrapped in `memo`: `render/form-container.tsx` gives every field a referentially stable
 * `onChange`/`onFocus`/`onBlur` (curried once per field name), so a keystroke in one field no
 * longer re-renders every other field's widget.
 */
export const FieldRenderer = memo(function FieldRenderer({
  field,
  value,
  onChange,
  fieldState,
  onFocus,
  onBlur,
}: Readonly<FieldRendererProps>) {
  return renderFieldWidget({
    field,
    value,
    onChange,
    fieldState,
    onFocus,
    onBlur,
  });
});

function renderFieldWidget({
  field,
  value,
  onChange,
  fieldState,
  onFocus,
  onBlur,
}: Readonly<FieldRendererProps>) {
  // Every `packages/ui` widget's `error` prop is a single string (see packages/ui/CLAUDE.md's
  // plain-scalar-prop rule), but a field can carry more than one error at once — e.g. a client
  // "required" error alongside a not-yet-dismissed server error for the same field name. Joining
  // them keeps every message visible instead of silently dropping all but the first.
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
          value={value}
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
          value={value}
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
          value={value}
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
          includesTime={field.includesTime}
          value={value}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    case "enum": {
      // Resolved off the raw property carried on the descriptor (see model/field-descriptor.ts's
      // doc comment) rather than as its own typed field — `resolveCreateFieldDescriptors` only
      // resolves INLINE options into `field.options`; remote-ness is read straight off the
      // HAL-FORMS property here.
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
          value={value}
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
          value={value}
          onChange={onChange}
          error={error}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      );
    }
    case "file":
      return (
        <FileRenderer
          name={field.name}
          label={field.label}
          required={field.required}
          readOnly={field.readOnly}
          description={field.description}
          multiple={field.multiple}
          value={value}
          onChange={onChange}
          error={error}
        />
      );
    default: {
      const exhaustive: never = field;
      return exhaustive;
    }
  }
}
