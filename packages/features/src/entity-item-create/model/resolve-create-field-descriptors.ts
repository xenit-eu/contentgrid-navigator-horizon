import type {
  CreateFormProperty,
  CreateFormRelationToManyProperty,
  CreateFormRelationToOneProperty,
  CreateHalFormTemplate,
  HalFormsProperty,
} from "@contentgrid/navigator-data";
import type { EnumOption } from "@contentgrid/ui";
import { formatFieldName } from "../../format-field-name";
import type { FieldDescriptor } from "./field-descriptor";
import type { LayoutInformation } from "./layout-information";

export interface ResolvedCreateFieldDescriptors {
  readonly fields: readonly FieldDescriptor[];
  readonly layout: LayoutInformation;
}

/**
 * Pure bridge: `CreateHalFormTemplate` (create-form template + profile metadata, already
 * classified by `packages/navigator-data/src/accessors/extended-forms/create-form.ts`) ->
 * `FieldDescriptor[]` + a single-group `LayoutInformation`, for `render/form-container.tsx`.
 *
 * No React, no fetching. Produces the `kind`-discriminated `FieldDescriptor` union, carrying the
 * raw `HalFormsProperty` through on every field (see `model/field-descriptor.ts`).
 *
 * Scope note: this covers the create-form path's user-defined attributes AND relations. It does
 * not produce a `filter`/`sort` descriptor — those are reserved union members for a future
 * search-form-aware bridge (see `model/field-descriptor.ts`'s doc comment for why).
 */
export function resolveCreateFieldDescriptors(
  template: CreateHalFormTemplate,
): ResolvedCreateFieldDescriptors {
  const descriptorsByName = new Map<string, FieldDescriptor>([
    ...template.userDefinedProperties.map(
      (prop) => [prop.property.name, attributeFieldDescriptor(prop)] as const,
    ),
    ...template.relationProperties.map(
      (prop) => [prop.property.name, relationFieldDescriptor(prop)] as const,
    ),
  ]);
  // In the create-form template's own property order, as legacy Navigator renders it.
  const fields = template.template.properties.flatMap(
    (property) => descriptorsByName.get(property.name) ?? [],
  );

  return {
    fields,
    layout: { groups: [{ fieldNames: fields.map((field) => field.name) }] },
  };
}

function relationFieldDescriptor(
  prop: CreateFormRelationToOneProperty | CreateFormRelationToManyProperty,
): FieldDescriptor {
  const { property, profileRelation, isRequired } = prop;
  return {
    kind: "relation",
    name: property.name,
    label: property.prompt ?? profileRelation?.title ?? formatFieldName(property.name),
    required: isRequired,
    readOnly: property.readOnly,
    description: profileRelation?.description || undefined,
    property,
    multiValue: property.multiValue,
  };
}

function attributeFieldDescriptor(prop: CreateFormProperty): FieldDescriptor {
  const { property, profileAttribute, isRequired, isContent } = prop;
  const base = {
    name: property.name,
    label: property.prompt ?? profileAttribute?.title ?? formatFieldName(property.name),
    required: isRequired,
    readOnly: property.readOnly,
    description: profileAttribute?.description || undefined,
    property,
  };

  if (isContent) {
    return { ...base, kind: "file", multiple: property.multiValue };
  }

  // Any options object — inline OR remote — makes this an "enum" descriptor. A remote source's
  // values aren't resolved here (that's a fetching concern kept out of this pure bridge — see
  // render/field-renderer.tsx, which reads remote-ness straight off the raw `property` carried on
  // the descriptor), so `options` is `[]` for a remote source; the renderer treats an empty
  // `options` + a remote property as "not yet loaded", not as "no choices".
  if (property.options) {
    return {
      ...base,
      kind: "enum",
      options: resolveInlineOptions(property) ?? [],
      multiValue: property.multiValue,
    };
  }

  // Compared against the raw wire-type strings (HalFormsPropertyType's own runtime values), not
  // the enum itself — @contentgrid/hal-forms/shape only re-exports HalFormsPropertyType as a type
  // under this repo's `verbatimModuleSyntax` setting, so it can't be used as a value here. Mirrors
  // packages/features/src/search/filter-properties.ts's mapWireTypeToInputKind.
  switch (property.type) {
    case "checkbox":
      return { ...base, kind: "boolean" };
    case "date":
      return { ...base, kind: "datetime", includesTime: false };
    case "datetime":
    case "datetime-local":
      return { ...base, kind: "datetime", includesTime: true };
    case "number":
    case "range":
      return { ...base, kind: "number" };
    // "url" is NOT a plain URL-formatted text attribute on this platform — it's the wire type
    // reserved exclusively for relations (see this file's `userDefinedProperties` doc comment in
    // navigator-data's create-form.ts: "3. Relations - Entity references (type: 'url')"), and is
    // already filtered out of `userDefinedProperties` before this function ever runs. Only
    // "email" is a real attribute-level format this switch needs to special-case.
    case "email":
      return {
        ...base,
        kind: "text",
        format: "email",
        regex: property.regex,
        maxLength: property.maxLength > 0 ? property.maxLength : undefined,
      };
    default:
      return {
        ...base,
        kind: "text",
        regex: property.regex,
        maxLength: property.maxLength > 0 ? property.maxLength : undefined,
      };
  }
}

/**
 * Only resolves an INLINE options source — a remote source's link is a data-fetching concern
 * that belongs in `render/field-renderer.tsx` (via the raw `property` carried on the
 * descriptor), not in this pure bridge.
 *
 * Keeps each option's `prompt` alongside its `value` (via `HalFormsProperty.options.toOption`):
 * `prompt` is the HAL-FORMS spec's human-readable label, distinct from the machine `value` —
 * attribute/enum values are customer-defined tokens (see root CLAUDE.md's "No hardcoded
 * attribute names" rule) and are not safe to reformat into a label client-side.
 */
function resolveInlineOptions(property: HalFormsProperty): readonly EnumOption[] | undefined {
  const { options } = property;
  if (!options) return undefined;
  if (options.isInline() && options.inline.length > 0) {
    return options.inline.map((value) => {
      const option = options.toOption(value);
      return { value: option.value, label: option.prompt };
    });
  }
  return undefined;
}
