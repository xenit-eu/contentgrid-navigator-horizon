import type {
  CreateFormProperty,
  CreateFormRelationToManyProperty,
  CreateFormRelationToOneProperty,
  CreateHalFormTemplate,
  HalFormsProperty,
} from "@contentgrid/navigator-data";
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
 * No React, no fetching — a direct replacement for the retired
 * `packages/navigator-data/src/form-fields/create-form-to-render-fields.ts`, now producing the
 * `kind`-discriminated `FieldDescriptor` union instead of `RenderFieldDescriptor`, and carrying
 * the raw `HalFormsProperty` through on every field (see `model/field-descriptor.ts`).
 *
 * Scope note (unchanged from the retired bridge): this only covers the create-form path. It does
 * not produce a `filter`/`sort` descriptor — those are reserved union members for a future
 * search-form-aware bridge.
 */
export function resolveCreateFieldDescriptors(
  template: CreateHalFormTemplate,
): ResolvedCreateFieldDescriptors {
  const fields: FieldDescriptor[] = [
    ...template.userDefinedProperties.map(attributeFieldDescriptor),
    ...template.toOneRelationProperties.map((prop) => relationFieldDescriptor(prop, "to-one")),
    ...template.toManyRelationProperties.map((prop) => relationFieldDescriptor(prop, "to-many")),
  ];

  return {
    fields,
    layout: { groups: [{ fieldNames: fields.map((field) => field.name) }] },
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

  // Any options object — inline OR remote — makes this an "enum" descriptor, mirroring the
  // retired bridge's buildOptionsSource. A remote source's values aren't resolved here (that's a
  // fetching concern kept out of this pure bridge — see render/field-renderer.tsx, which reads
  // remote-ness straight off the raw `property` carried on the descriptor), so `options` is `[]`
  // for a remote source; the renderer treats an empty `options` + a remote property as
  // "not yet loaded", not as "no choices".
  if (property.options) {
    return {
      ...base,
      kind: "enum",
      options: resolveInlineOptionValues(property) ?? [],
      multiValue: property.multiValue,
    };
  }

  // Compared against the raw wire-type strings (HalFormsPropertyType's own runtime values), not
  // the enum itself — @contentgrid/hal-forms/shape only re-exports HalFormsPropertyType as a type
  // under this repo's `verbatimModuleSyntax` setting, so it can't be used as a value here. Mirrors
  // the retired create-form-to-render-fields.ts's own switch, and
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

/** The value the server expects to submit for a linked item — every relation renderer in this
 * codebase already submits an item's self href directly (see the retired
 * `relation-field.tsx`'s `RelationToOneRenderer`/`RelationToManyRenderer` usage), so this is a
 * fixed default rather than something read off the wire template today. Kept as its own field
 * (rather than hardcoded at the render site) because the raw HAL-FORMS options wire shape already
 * carries a `valueField` hint for a future server-driven convention. */
const DEFAULT_RELATION_VALUE_FIELD = "/_links/self/href";

function relationFieldDescriptor(
  prop: CreateFormRelationToOneProperty | CreateFormRelationToManyProperty,
  cardinality: "to-one" | "to-many",
): FieldDescriptor {
  const { property, profileRelation, targetCollectionHref, isRequired } = prop;
  return {
    name: property.name,
    label: property.prompt ?? profileRelation?.title ?? formatFieldName(property.name),
    required: isRequired,
    readOnly: property.readOnly,
    description: profileRelation?.description || undefined,
    property,
    kind: "relation",
    cardinality,
    targetHref: targetCollectionHref,
    valueField: DEFAULT_RELATION_VALUE_FIELD,
  };
}

/**
 * Only resolves an INLINE options source to plain values — a remote source's link is a
 * data-fetching concern that belongs in `render/field-renderer.tsx` (via the raw `property`
 * carried on the descriptor), not in this pure bridge. Mirrors the retired bridge's
 * `buildOptionsSource`, but returns bare values (this ticket has no field-level need for a
 * separate prompt/value pair beyond what `HalFormsProperty.options` itself already exposes to a
 * renderer that wants it).
 */
function resolveInlineOptionValues(property: HalFormsProperty): readonly string[] | undefined {
  const { options } = property;
  if (!options) return undefined;
  if (options.isInline() && options.inline.length > 0) {
    return options.inline.map((value) => options.toOption(value).value);
  }
  return undefined;
}

function formatFieldName(name: string): string {
  return name
    .replace(/[._]/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
