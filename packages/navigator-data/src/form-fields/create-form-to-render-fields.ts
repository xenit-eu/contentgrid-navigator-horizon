import type { HalFormsProperty } from "@contentgrid/hal-forms";
import type {
  CreateFormProperty,
  CreateFormRelationToManyProperty,
  CreateFormRelationToOneProperty,
  CreateHalFormTemplate,
} from "../accessors/extended-forms/create-form";
import type { FieldOptionsSource, RenderFieldDescriptor } from "./render-field-descriptor";

/**
 * Bridges a `CreateHalFormTemplate` (create-form template + profile metadata, already
 * classified by packages/navigator-data/src/accessors/extended-forms/create-form.ts) into
 * `RenderFieldDescriptor[]` for `packages/ui`'s form-renderer registry (ADR-004).
 *
 * Scope note: this only covers the create-form path. It does NOT produce a `typeahead`
 * descriptor — an attribute field with a matching prefix/full-text search counterpart (e.g. via
 * `useTypeahead` from `../hooks/collection/use-typeahead`) needs a search-template cross-lookup
 * that has no place in a create-form-only bridge.
 *
 * `typeahead` is still modelled on `RenderFieldDescriptor` (see render-field-descriptor.ts) so
 * the exhaustive dispatch registry has a real case for it once a search-form-aware bridge (or
 * an extension of this one) is built to produce it.
 */
export function createFormToRenderFields(
  createTemplate: CreateHalFormTemplate,
): RenderFieldDescriptor[] {
  return [
    ...createTemplate.userDefinedProperties.map(attributeFieldDescriptor),
    ...createTemplate.toOneRelationProperties.map(relationToOneFieldDescriptor),
    ...createTemplate.toManyRelationProperties.map(relationToManyFieldDescriptor),
  ];
}

function attributeFieldDescriptor(prop: CreateFormProperty): RenderFieldDescriptor {
  const { property, profileAttribute, isRequired, isContent } = prop;
  const base = {
    name: property.name,
    label: property.prompt ?? profileAttribute?.title ?? formatFieldName(property.name),
    required: isRequired,
    readOnly: property.readOnly,
    description: profileAttribute?.description || undefined,
  };

  if (isContent) {
    return { ...base, type: "file", multiple: property.multiValue };
  }

  const optionsSource = buildOptionsSource(property);
  if (optionsSource) {
    return property.multiValue
      ? { ...base, type: "enum-multi", optionsSource }
      : { ...base, type: "enum", optionsSource };
  }

  // Compared against the raw wire-type strings (HalFormsPropertyType's own runtime values),
  // not the enum itself — @contentgrid/hal-forms/shape only re-exports HalFormsPropertyType as
  // a type under this repo's `verbatimModuleSyntax` setting, so it can't be used as a value here.
  // Mirrors packages/features/src/search/filter-properties.ts's mapWireTypeToInputKind.
  switch (property.type) {
    case "checkbox":
      return { ...base, type: "boolean" };
    case "date":
      return { ...base, type: "datetime", includesTime: false };
    case "datetime":
    case "datetime-local":
      return { ...base, type: "datetime", includesTime: true };
    case "number":
    case "range":
      return { ...base, type: "number" };
    default:
      return {
        ...base,
        type: "text",
        regex: property.regex,
        minLength: property.minLength,
        maxLength: property.maxLength,
      };
  }
}

function relationToOneFieldDescriptor(
  prop: CreateFormRelationToOneProperty,
): RenderFieldDescriptor {
  const { property, profileRelation, targetCollectionHref, isRequired } = prop;
  return {
    name: property.name,
    label: property.prompt ?? profileRelation?.title ?? formatFieldName(property.name),
    required: isRequired,
    readOnly: property.readOnly,
    description: profileRelation?.description || undefined,
    type: "relation-to-one",
    profileRelation,
    targetCollectionHref,
  };
}

function relationToManyFieldDescriptor(
  prop: CreateFormRelationToManyProperty,
): RenderFieldDescriptor {
  const { property, profileRelation, targetCollectionHref, isRequired } = prop;
  return {
    name: property.name,
    label: property.prompt ?? profileRelation?.title ?? formatFieldName(property.name),
    required: isRequired,
    readOnly: property.readOnly,
    description: profileRelation?.description || undefined,
    type: "relation-to-many",
    profileRelation,
    targetCollectionHref,
  };
}

/**
 * Normalizes a property's options via the options object's own `toOption()` — handles both a
 * plain inline string array and an inline array of richer objects (`promptField`/`valueField`)
 * uniformly, rather than assuming inline values are strings.
 */
function buildOptionsSource(property: HalFormsProperty): FieldOptionsSource | undefined {
  const { options } = property;
  if (!options) return undefined;
  if (options.isRemote()) {
    return { kind: "remote", link: options.link };
  }
  if (options.isInline() && options.inline.length > 0) {
    return {
      kind: "inline",
      options: options.inline.map((value) => {
        const option = options.toOption(value);
        return { value: option.value, label: option.prompt };
      }),
    };
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
