import type { ReactNode } from "react";
import type { FieldValue, ProfileEntity } from "@contentgrid/navigator-data";
import {
  BooleanRenderer,
  DateTimeRenderer,
  EnumMultiRenderer,
  EnumRenderer,
  NumberRenderer,
  TextRenderer,
} from "@contentgrid/ui";
import type { FieldDescriptor } from "../model/field-descriptor";
import type { FieldState } from "../state/field-error";
import { RelationField, type RelationFieldDescriptor } from "./relation-field";

/**
 * Wiring for the `relation` case's `render/relation-field.tsx` — the one "packages/ui can't
 * fetch, but the relation FieldRenderer case may" exception the ADR-004 rewrite carves out.
 * Threaded down from `create-entity-item-container.tsx` via `form-container.tsx`'s
 * `FormContainerProps.relationFieldData`.
 */
export interface RelationFieldData {
  readonly resolveTargetProfile: (field: RelationFieldDescriptor) => ProfileEntity | undefined;
  readonly relationItemsData: Readonly<Record<string, Record<string, unknown>>>;
  readonly onItemResolved: (href: string, data: Record<string, unknown>) => void;
  readonly renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
  /** See `render/relation-field.tsx`'s `RelationFieldProps.onViewRelationItem` doc comment. */
  readonly onViewRelationItem?: (targetProfile: ProfileEntity, itemId: string) => void;
}

/**
 * A value extracted from the uploaded PDF content, offered back to one field. An interface
 * (not a fixed value type) so the AI-extraction feature can grow this shape — e.g. a source
 * citation, a confidence score — without a second prop-surface retrofit. Threaded down from
 * `create-entity-item-container.tsx`'s `annotations` prop; `create-entity-item-form.tsx` turns it
 * into a `renderBottomChildren` closure rather than this component knowing about annotations
 * directly — see that prop's doc comment below.
 */
export interface FieldAnnotation {
  readonly extractedValue: FieldValue;
}

export interface FieldRendererProps {
  readonly field: FieldDescriptor;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly fieldState?: FieldState;
  readonly relationFieldData?: RelationFieldData;
  /**
   * Generic per-field extra content, rendered below the field's widget — e.g. the
   * AI-extraction "Use extracted value" button `create-entity-item-form.tsx` builds from its
   * `annotations` prop, but this component has no knowledge of annotations itself. Kept as a
   * `(fieldName) => ReactNode` render prop (rather than a fixed `annotation` shape) so any future
   * per-field affordance can reuse this same slot without another prop-surface retrofit here.
   */
  readonly renderBottomChildren?: (fieldName: string) => ReactNode;
  /**
   * Forwarded straight to the underlying `packages/ui` widget's native input for the field kinds
   * that have exactly one focusable element (`text`, `number`, `boolean`, `datetime`, single-value
   * `enum`). Not supported for `enum` with `multiValue` (one checkbox per option) or `relation`
   * (a link/unlink button plus a picker dialog) — those are composite widgets with no single
   * element a lone `onFocus`/`onBlur` pair could unambiguously target.
   */
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
}

/**
 * Dispatches a `FieldDescriptor` to its renderer (ADR-004's `FieldRenderer` switch, replacing
 * the retired `packages/ui/src/patterns/form-renderers/field-renderer.tsx`). Now lives in
 * `packages/features` rather than `packages/ui` specifically so the `relation` case can fetch
 * via `@contentgrid/navigator-data` hooks (`render/relation-field.tsx`) — `packages/ui` cannot.
 *
 * `file` is rendered as an inert placeholder — it's covered by another ticket. `filter` and `sort`
 * are intentionally NOT cases here at all — see `model/field-descriptor.ts`'s doc comment for why
 * they're kept out of the `FieldDescriptor` union entirely rather than routed through this
 * per-field switch. The `never` check in `default` is a compile-time exhaustiveness guard, not a
 * real runtime path today.
 */
export function FieldRenderer({
  field,
  value,
  onChange,
  fieldState,
  relationFieldData,
  renderBottomChildren,
  onFocus,
  onBlur,
}: Readonly<FieldRendererProps>) {
  const widget = renderFieldWidget({
    field,
    value,
    onChange,
    fieldState,
    relationFieldData,
    onFocus,
    onBlur,
  });
  const bottomChildren = renderBottomChildren?.(field.name);

  if (!bottomChildren) return widget;

  return (
    <div className="space-y-1">
      {widget}
      {bottomChildren}
    </div>
  );
}

function renderFieldWidget({
  field,
  value,
  onChange,
  fieldState,
  relationFieldData,
  onFocus,
  onBlur,
}: Readonly<Omit<FieldRendererProps, "renderBottomChildren">>) {
  const error = fieldState?.errors[0]?.message;

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
          min={field.min}
          max={field.max}
          step={field.step}
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
      // HAL-FORMS property here, the same way the retired bridge's buildOptionsSource did.
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
    case "relation": {
      const targetProfile = relationFieldData?.resolveTargetProfile(field);
      if (!relationFieldData || !targetProfile) {
        return (
          <p className="text-sm text-muted-foreground">
            {field.label}: related entity profile unavailable for linking.
          </p>
        );
      }
      return (
        <RelationField
          field={field}
          targetProfile={targetProfile}
          value={value}
          onChange={onChange}
          error={error}
          relationItemsData={relationFieldData.relationItemsData}
          onItemResolved={relationFieldData.onItemResolved}
          renderCreateRelationTarget={relationFieldData.renderCreateRelationTarget}
          onViewRelationItem={relationFieldData.onViewRelationItem}
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

function UnsupportedFieldPlaceholder({ field }: Readonly<{ field: FieldDescriptor }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{field.label}</p>
      <p className="text-sm text-muted-foreground">
        This field type (&quot;{field.kind}&quot;) is not yet supported in this form.
      </p>
    </div>
  );
}
