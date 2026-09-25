import type {
  CreateFormProperty,
  CreateHalFormTemplate,
  HalFormsProperty,
  ProfileEntity,
  SearchHalFormTemplateProperty,
} from "@contentgrid/navigator-data";
import { SearchHalFormTemplate } from "@contentgrid/navigator-data";
import type { EnumOption } from "@contentgrid/ui";
import { formatFieldName } from "../../format-field-name";
import { directionLabel, generateSearchFormLayout } from "./generate-search-form-layout";
import type { HalFormsField } from "./hal-forms-field";
import type { FieldSection, LayoutSchema } from "./layout-schema";

export interface ResolvedHalFormsFields {
  readonly fields: readonly HalFormsField[];
  readonly layout: LayoutSchema;
}

/**
 * Pure bridge: `CreateHalFormTemplate | SearchHalFormTemplate` -> `HalFormsField[]` + a
 * single-section `LayoutSchema`, for `render/hal-forms-container.tsx`. Generalizes
 * `entity-item-create`'s `resolveCreateFieldDescriptors` (ADR-004) — same per-property `kind`
 * mapping for the create path — to also cover a search template (see `research.md`'s parity
 * decision).
 *
 * The layout is always the default:
 * - a create template: one field per row, in template order (FR-009);
 * - a search template: `generateSearchFormLayout`'s generated default, pairing `~before`/`~after`
 *   range variants (FR-018/FR-021).
 *
 * `autocompleteFieldNames` (FR-017) opts a field into the `autocomplete` kind instead of the
 * plain `text` kind its wire type would otherwise produce. There is no schema-level signal
 * (e.g. a `blueprint:attribute` constraint) marking a property as autocomplete-eligible today —
 * this is the caller-supplied opt-in `data-model.md` reserves for that until one exists. Has no
 * effect on a field that isn't `text` in the first place (e.g. it never turns an `enum` or
 * `number` field into an autocomplete one).
 */
export function resolveHalFormsFields(
  template: CreateHalFormTemplate | SearchHalFormTemplate,
  autocompleteFieldNames?: readonly string[],
): ResolvedHalFormsFields {
  const isSearchTemplate = template instanceof SearchHalFormTemplate;
  const resolvedFields: HalFormsField[] = isSearchTemplate
    ? resolveSearchFields(template)
    : template.userDefinedProperties.map(attributeHalFormsField);
  const fields = applyAutocompleteOverride(resolvedFields, autocompleteFieldNames);

  const layout = isSearchTemplate
    ? generateSearchFormLayout(template, fields)
    : { sections: [buildFieldSection(fields)] };

  return { fields, layout };
}

function applyAutocompleteOverride(
  fields: readonly HalFormsField[],
  autocompleteFieldNames: readonly string[] | undefined,
): HalFormsField[] {
  if (!autocompleteFieldNames || autocompleteFieldNames.length === 0) return [...fields];

  const opted = new Set(autocompleteFieldNames);
  return fields.map((field) => {
    if (field.kind !== "text" || !opted.has(field.name)) return field;
    return {
      name: field.name,
      label: field.label,
      required: field.required,
      readOnly: field.readOnly,
      description: field.description,
      property: field.property,
      kind: "autocomplete",
      multiValue: false,
    };
  });
}

function buildFieldSection(fields: readonly HalFormsField[]): FieldSection {
  return { rows: fields.map((field) => ({ fieldNames: [field.name] })) };
}

/** Fields every kind mapping needs, before the `kind`-specific branch decides the rest. */
interface FieldMappingInput {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly description: string | undefined;
  readonly property: HalFormsProperty;
}

function attributeHalFormsField(prop: CreateFormProperty): HalFormsField {
  const { property, profileAttribute, isRequired, isContent } = prop;
  const base: FieldMappingInput = {
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

  return mapToHalFormsField(base, property);
}

/**
 * Search-property counterpart of `attributeHalFormsField`. A search property is never content
 * (content attributes aren't searchable), so a non-string-searchable one always goes through the
 * shared `mapToHalFormsField` switch, same as a non-content create property does.
 *
 * A prefix-match or full-text property, though, always resolves to the `autocomplete` kind
 * (FR-017) — every such property in the existing `filter-sidebar.tsx`/`TypeaheadTextFilter`
 * mechanism this is meant to reach parity with (FR-023) already gets suggest-as-you-type
 * behavior, so this isn't an opt-in the way it is for a create-form field (see
 * `applyAutocompleteOverride`) — it's the direct analog of what the property already does
 * today. `searchContext` carries everything `useTypeahead` needs — the caller (e.g.
 * `entity-item-collection-view.tsx`) reads it off the field rather than re-deriving the same
 * `SearchHalFormTemplateProperty`/`ProfileEntity` lookup itself; that caller still owns the
 * actual `useTypeahead` call (see `HalFormsFieldRenderer`'s doc comment for why this render layer
 * never fetches anything itself).
 *
 * A directional range property (`~gt`/`~gte`/`~lt`/`~lte`/`~after`/`~before`/`~from`/`~until`)
 * uses its bare direction word ("After"/"Before"/"From"/"Until") as its whole label, rather than
 * `property.prompt`/`profileAttribute?.title`, and the exact-match variant of that same
 * attribute (`isInRangeGroup`) keeps its attribute label only as its accessible name
 * (`hideLabel`) — the attribute's name (and description) is shown once, on the nested section
 * `generate-search-form-layout.ts` groups them into (`rangeAttributeSection`), rather than
 * repeated on every variant. That section renders as a `fieldset` with the attribute as its
 * legend, so each input's accessible context still names the attribute.
 *
 * Search-only filtering happens in `resolveSearchFields`, ported from
 * `packages/features/src/search/filter-properties.ts`'s `buildFilterProperties`: the `hidden`
 * wire type (internal relation-scoping params, never user-facing) is excluded entirely, and a
 * redundant sibling for the same `groupKey` — a broader exact-match once a narrower
 * prefix/full-text variant exists, or a strict range bound once its inclusive equivalent exists
 * — is suppressed. Unlike that module, this returns `HalFormsField[]` (carrying the raw
 * `property`), not the `@contentgrid/ui`-shaped `SearchFilterProperty` view model, which
 * deliberately can't carry a `HalFormsProperty` at all (`packages/ui` may not import
 * `@contentgrid/navigator-data` types).
 */
function searchPropertyHalFormsField(
  sp: SearchHalFormTemplateProperty,
  profileEntity: ProfileEntity,
  isInRangeGroup: boolean,
): HalFormsField {
  const { property, profileAttribute, groupKey } = sp;
  const baseLabel = property.prompt ?? profileAttribute?.title ?? formatFieldName(groupKey);
  const direction = directionLabel(sp);
  const base: FieldMappingInput = {
    name: property.name,
    label: direction ?? baseLabel,
    required: false,
    readOnly: false,
    // The relation's own description belongs on that relation's section header
    // (`generate-search-form-layout.ts`'s `groupRowsIntoSections`), not repeated on every one of
    // its fields — `profileAttribute` never resolves for a relation-traversal property (see this
    // function's own doc comment), so such a field simply has no description of its own. A range
    // attribute's description likewise lives on its nested section instead.
    description: isInRangeGroup ? undefined : profileAttribute?.description || undefined,
    property,
  };

  if (isStringSearchable(sp)) {
    return {
      ...base,
      kind: "autocomplete",
      multiValue: false,
      searchContext: { profileEntity, searchProperty: sp },
    };
  }

  const field = mapToHalFormsField(base, property);
  if (isInRangeGroup && !direction && (field.kind === "number" || field.kind === "datetime")) {
    return { ...field, hideLabel: true };
  }
  return field;
}

function isStringSearchable(sp: SearchHalFormTemplateProperty): boolean {
  const operator = searchOperatorOf(sp);
  return operator === "prefix-match" || operator === "full-text";
}

function resolveSearchFields(template: SearchHalFormTemplate): HalFormsField[] {
  const properties = template.searchProperties.filter((sp) => sp.property.type !== "hidden");
  const surviving = properties.filter((sp) => !isRedundantSearchField(sp, properties));
  // Same "has a range variant" test `generateSearchFormLayout` uses to give an attribute its own
  // nested section, so every field it places in one is labelled for it.
  const rangeGroupKeys = new Set(
    surviving.filter((sp) => directionLabel(sp) !== undefined).map((sp) => sp.groupKey),
  );
  return surviving.map((sp) =>
    searchPropertyHalFormsField(sp, template.profileEntity, rangeGroupKeys.has(sp.groupKey)),
  );
}

/** Shared `kind` switch for both a create and a search property's non-content mapping. */
function mapToHalFormsField(base: FieldMappingInput, property: HalFormsProperty): HalFormsField {
  // TODO: revisit when multi-value attributes arrive. in this case the inline options will be missing
  if (property.options) {
    return {
      ...base,
      kind: "enum",
      options: resolveInlineOptions(property) ?? [],
      multiValue: property.multiValue,
    };
  }

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

const KNOWN_SEARCH_OPERATORS = new Set([
  "exact-match",
  "prefix-match",
  "full-text",
  "greater-than",
  "greater-than-or-equal",
  "less-than",
  "less-than-or-equal",
]);

function searchOperatorOf(sp: SearchHalFormTemplateProperty): string {
  return KNOWN_SEARCH_OPERATORS.has(sp.searchType) ? sp.searchType : "exact-match";
}

/**
 * Ported from `filter-properties.ts`'s `isRedundantExactMatch`/`isRedundantStrictRangeBound`: an
 * exact-match property is redundant once a narrower (prefix/full-text) sibling exists for the
 * same `groupKey`. A `datetime` exact-match property is also redundant once a range sibling
 * exists: its input is minute precision, so it would practically never equal a stored
 * timestamp, and the range pair covers the real use case. A `date` or number exact-match
 * property is kept next to its range siblings ("everything due on 24 Sep" is a real query) —
 * `generate-search-form-layout.ts` places them together in the attribute's section. A strict range bound
 * (`greater-than`/`less-than`) is redundant once its inclusive equivalent
 * (`greater-than-or-equal`/`less-than-or-equal`) exists for the same `groupKey`.
 */
function isRedundantSearchField(
  sp: SearchHalFormTemplateProperty,
  allProperties: readonly SearchHalFormTemplateProperty[],
): boolean {
  const operator = searchOperatorOf(sp);
  const siblings = allProperties.filter((other) => other.groupKey === sp.groupKey);

  if (operator === "exact-match") {
    const isDatetime = sp.property.type === "datetime" || sp.property.type === "datetime-local";
    return siblings.some((other) => {
      const otherOperator = searchOperatorOf(other);
      return (
        otherOperator === "prefix-match" ||
        otherOperator === "full-text" ||
        (isDatetime && directionLabel(other) !== undefined)
      );
    });
  }

  if (operator === "greater-than" || operator === "less-than") {
    const inclusiveEquivalent =
      operator === "greater-than" ? "greater-than-or-equal" : "less-than-or-equal";
    return siblings.some((other) => searchOperatorOf(other) === inclusiveEquivalent);
  }

  return false;
}

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
