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
 * `savedLayout` is a `LayoutSchema`'s plain `string[][]` row shape (one row per array, 1-2 field
 * names each), in display order. It is reconciled against this template's own fields rather than
 * trusted as-is:
 * - A row's reference to a field absent from `fields` (stale — removed/renamed on the template)
 *   is dropped from that row; a row emptied that way is dropped entirely (FR-007).
 * - A field's first occurrence (row order) wins; every later duplicate reference is ignored (FR-006).
 * - A field present in `fields` but never named by any row is OMITTED — not rendered at all
 *   (FR-004). This is the one place this deliberately diverges from
 *   `resolveCreateFieldDescriptors`, which auto-appends an unreferenced field instead — see
 *   `research.md`'s and `data-model.md`'s notes on why that behavior does NOT carry over here.
 *
 * Omitting `savedLayout` entirely (or passing `[]`) falls back to:
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
  savedLayout?: readonly (readonly string[])[],
  autocompleteFieldNames?: readonly string[],
): ResolvedHalFormsFields {
  const isSearchTemplate = template instanceof SearchHalFormTemplate;
  const resolvedFields: HalFormsField[] = isSearchTemplate
    ? resolveSearchFields(template)
    : template.userDefinedProperties.map(attributeHalFormsField);
  const fields = applyAutocompleteOverride(resolvedFields, autocompleteFieldNames);

  if (savedLayout && savedLayout.length > 0) {
    return { fields, layout: { sections: [buildFieldSection(fields, savedLayout)] } };
  }

  const layout = isSearchTemplate
    ? generateSearchFormLayout(template, fields)
    : { sections: [buildFieldSection(fields, undefined)] };

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

function buildFieldSection(
  fields: readonly HalFormsField[],
  savedLayout: readonly (readonly string[])[] | undefined,
): FieldSection {
  if (!savedLayout || savedLayout.length === 0) {
    return { rows: fields.map((field) => ({ fieldNames: [field.name] })) };
  }

  const knownNames = new Set(fields.map((field) => field.name));
  const seenNames = new Set<string>();
  const rows: { fieldNames: string[] }[] = [];

  for (const row of savedLayout) {
    const reconciledRow = row.filter((name) => knownNames.has(name) && !seenNames.has(name));
    reconciledRow.forEach((name) => seenNames.add(name));
    if (reconciledRow.length > 0) rows.push({ fieldNames: reconciledRow });
  }

  return { rows };
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
 * gets its direction ("After"/"Before"/"From"/"Until") appended to its label — `property.prompt`/
 * `profileAttribute?.title` alone would give every sibling sharing one `groupKey` the SAME label
 * (e.g. two fields both just called "Created"), which is exactly the ambiguity the former
 * `filter-sidebar.tsx`'s separate `directionLabel` sub-badge existed to avoid. `HalFormsField` has
 * no equivalent side-channel for a sub-label, so it's folded into the one label this type does
 * have instead.
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
): HalFormsField {
  const { property, profileAttribute, groupKey } = sp;
  const baseLabel = property.prompt ?? profileAttribute?.title ?? formatFieldName(groupKey);
  const direction = directionLabel(sp);
  const base: FieldMappingInput = {
    name: property.name,
    label: direction ? `${baseLabel} ${direction}` : baseLabel,
    required: false,
    readOnly: false,
    // The relation's own description belongs on that relation's section header
    // (`generate-search-form-layout.ts`'s `groupRowsIntoSections`), not repeated on every one of
    // its fields — `profileAttribute` never resolves for a relation-traversal property (see this
    // function's own doc comment), so such a field simply has no description of its own.
    description: profileAttribute?.description || undefined,
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

  return mapToHalFormsField(base, property);
}

function isStringSearchable(sp: SearchHalFormTemplateProperty): boolean {
  const operator = searchOperatorOf(sp);
  return operator === "prefix-match" || operator === "full-text";
}

function resolveSearchFields(template: SearchHalFormTemplate): HalFormsField[] {
  const properties = template.searchProperties.filter((sp) => sp.property.type !== "hidden");
  const mapped = properties.map((sp) => ({
    sp,
    field: searchPropertyHalFormsField(sp, template.profileEntity),
  }));
  return mapped
    .filter(({ sp, field }) => !isRedundantSearchField(sp, field.kind, properties))
    .map(({ field }) => field);
}

/** Shared `kind` switch for both a create and a search property's non-content mapping. */
function mapToHalFormsField(base: FieldMappingInput, property: HalFormsProperty): HalFormsField {
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

function isDirectional(operator: string): boolean {
  return (
    operator === "greater-than" ||
    operator === "greater-than-or-equal" ||
    operator === "less-than" ||
    operator === "less-than-or-equal"
  );
}

/**
 * Ported from `filter-properties.ts`'s `isRedundantExactMatch`/`isRedundantStrictRangeBound`: an
 * exact-match property is redundant once a narrower (prefix/full-text) sibling exists for the
 * same `groupKey`, or — for a datetime/datetime-local attribute only — a range/direction sibling
 * exists; a strict range bound (`greater-than`/`less-than`) is redundant once its inclusive
 * equivalent (`greater-than-or-equal`/`less-than-or-equal`) exists for the same `groupKey`.
 */
function isRedundantSearchField(
  sp: SearchHalFormTemplateProperty,
  kind: HalFormsField["kind"],
  allProperties: readonly SearchHalFormTemplateProperty[],
): boolean {
  const operator = searchOperatorOf(sp);
  const siblings = allProperties.filter((other) => other.groupKey === sp.groupKey);

  if (operator === "exact-match") {
    return siblings.some((other) => {
      const otherOperator = searchOperatorOf(other);
      return (
        otherOperator === "prefix-match" ||
        otherOperator === "full-text" ||
        (isDirectional(otherOperator) && kind === "datetime")
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
