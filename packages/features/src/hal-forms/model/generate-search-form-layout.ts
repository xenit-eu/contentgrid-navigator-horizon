import type {
  ProfileRelation,
  SearchHalFormTemplate,
  SearchHalFormTemplateProperty,
} from "@contentgrid/navigator-data";
import { formatFieldName } from "../../format-field-name";
import type { HalFormsField } from "./hal-forms-field";
import type { FieldRow, FieldSection, LayoutSchema } from "./layout-schema";

/**
 * FR-018/019/020, FR-028: a search form's default layout schema when no explicit one is
 * supplied.
 *
 * Every attribute with at least one surviving range variant (`~gte`/`~lte`/`~after`/`~before`/…)
 * gets its rows kept together (`rangeAttributeRows`): the attribute's other variants (e.g. its
 * exact-match property) first, one per row, then the range variants — paired onto one row when
 * both bounds survived, else one per row. The range fields carry the attribute in their own
 * label ("Age from"/"Age until", see `resolve-hal-forms-fields.ts`), and the attribute's
 * description sits once on the last range row rather than under each field. These rows sit where
 * the attribute's first field appears in `fields`; every other field gets its own full-width
 * row, in `fields` order.
 *
 * Rows are then grouped into sections (FR-028): every relation-traversal property (e.g.
 * "customer.name") is placed into a collapsible section named for its relation, one section per
 * relation, in first-appearance order; every direct (non-relation) property stays in a single
 * plain, non-collapsible leading section.
 *
 * Takes the already-resolved `fields` (not the raw template) rather than re-deriving which
 * search properties are redundant (e.g. a strict `~gt` bound once an inclusive `~gte` sibling
 * exists) itself — `resolve-hal-forms-fields.ts`'s search-property mapping is the one place that
 * decision is made, so this only ever groups fields that already made the cut. This IS an
 * ordinary layout schema, not a special-cased rendering rule — every other layout requirement
 * (row-size cap, ordering, omission, duplicate handling, all applied downstream by
 * `resolve-hal-forms-fields.ts`'s reconciliation) works on it exactly as it would on a
 * hand-authored or, later, an administrator-edited schema.
 */
export function generateSearchFormLayout(
  searchTemplate: SearchHalFormTemplate,
  fields: readonly HalFormsField[],
): LayoutSchema {
  const searchPropertyByName = new Map(
    searchTemplate.searchProperties.map((sp) => [sp.property.name, sp] as const),
  );

  const fieldsByGroupKey = new Map<string, HalFormsField[]>();
  for (const field of fields) {
    const groupKey = searchPropertyByName.get(field.name)?.groupKey;
    if (groupKey === undefined) continue;
    const siblings = fieldsByGroupKey.get(groupKey) ?? [];
    siblings.push(field);
    fieldsByGroupKey.set(groupKey, siblings);
  }
  const isRangeField = (field: HalFormsField) => {
    const sp = searchPropertyByName.get(field.name);
    return sp !== undefined && directionLabel(sp) !== undefined;
  };

  const rows: RelationScopedRow[] = [];
  const placedNames = new Set<string>();

  for (const field of fields) {
    if (placedNames.has(field.name)) continue;

    const sp = searchPropertyByName.get(field.name);
    const relation = sp?.isOverRelation ? sp.profileRelation : undefined;
    const siblings = sp ? (fieldsByGroupKey.get(sp.groupKey) ?? []) : [];
    const rangeFields = siblings.filter(isRangeField);

    if (sp && rangeFields.length > 0) {
      const otherFields = siblings.filter((sibling) => !isRangeField(sibling));
      for (const row of rangeAttributeRows(sp, otherFields, rangeFields)) {
        rows.push({ row, relation });
      }
      siblings.forEach((sibling) => placedNames.add(sibling.name));
      continue;
    }

    rows.push({ row: { fieldNames: [field.name] }, relation });
    placedNames.add(field.name);
  }

  return { sections: groupRowsIntoSections(rows) };
}

interface RelationScopedRow {
  readonly row: FieldRow;
  readonly relation: ProfileRelation | undefined;
}

/**
 * One range attribute's rows: its other variants one per row, then its range bounds — paired
 * when both survived. The attribute's description goes on the last range row only, once.
 */
function rangeAttributeRows(
  sp: SearchHalFormTemplateProperty,
  otherFields: readonly HalFormsField[],
  rangeFields: readonly HalFormsField[],
): FieldRow[] {
  const rangeRows: FieldRow[] =
    rangeFields.length === 2
      ? [{ fieldNames: rangeFields.map((field) => field.name) }]
      : rangeFields.map((field) => ({ fieldNames: [field.name] }));
  const description = sp.profileAttribute?.description || undefined;
  if (description) {
    rangeRows[rangeRows.length - 1] = { ...rangeRows[rangeRows.length - 1], description };
  }
  return [...otherFields.map((field) => ({ fieldNames: [field.name] })), ...rangeRows];
}

/**
 * A range attribute's name, as its range fields' label prefix (`resolve-hal-forms-fields.ts`).
 * Not `property.prompt` — that names a single variant (e.g. "Age : From"). A relation-traversal
 * property is "{Relation} : {Attribute}" (e.g. "Friends : Age"); it never resolves a
 * `profileAttribute` (see `SearchHalFormTemplateProperty`), so the attribute part falls back to
 * the last `groupKey` segment.
 */
export function rangeAttributeTitle(sp: SearchHalFormTemplateProperty): string {
  const { profileAttribute, groupKey } = sp;
  const attributeTitle =
    profileAttribute?.title ?? formatFieldName(groupKey.slice(groupKey.lastIndexOf(".") + 1));
  const relationTitle = sp.isOverRelation ? sp.profileRelation?.title : undefined;
  return relationTitle ? `${relationTitle} : ${attributeTitle}` : attributeTitle;
}

/**
 * FR-028: buckets rows into a leading, plain section for every direct property plus one
 * collapsible, relation-titled section per relation — in the relation's first appearance order
 * among `rows`, not alphabetical or profile-declaration order, so a caller sees sections in the
 * same order the fields themselves would have appeared in a flat layout.
 *
 * A relation section's `description` is the relation's own `ProfileRelation.description` — shown
 * once, on the section header, not on every field inside it. `searchPropertyHalFormsField`
 * (`resolve-hal-forms-fields.ts`) deliberately does NOT fall back to `profileRelation.description`
 * for an individual field's own `description` any more, precisely so the two don't duplicate the
 * same text at both levels.
 */
function groupRowsIntoSections(rows: readonly RelationScopedRow[]): FieldSection[] {
  const directRows: FieldRow[] = [];
  const relationOrder: string[] = [];
  const relationsByKey = new Map<string, ProfileRelation>();
  const rowsByRelationKey = new Map<string, FieldRow[]>();

  for (const { row, relation } of rows) {
    if (!relation) {
      directRows.push(row);
      continue;
    }

    const key = relation.name;
    if (!relationsByKey.has(key)) {
      relationsByKey.set(key, relation);
      rowsByRelationKey.set(key, []);
      relationOrder.push(key);
    }
    rowsByRelationKey.get(key)!.push(row);
  }

  const sections: FieldSection[] = [];
  if (directRows.length > 0) sections.push({ rows: directRows });
  for (const key of relationOrder) {
    const relation = relationsByKey.get(key)!;
    sections.push({
      title: relation.title,
      description: relation.description || undefined,
      isCollapsible: true,
      rows: rowsByRelationKey.get(key)!,
    });
  }
  return sections;
}

/**
 * Mirrors `packages/features/src/search/filter-properties.ts`'s `computeDirectionLabel` — same
 * four-way classification — kept local (rather than importing that module's) so this pure model
 * function doesn't need to depend on `@contentgrid/ui`'s `SearchOperator` type for one small
 * switch. Exported so `resolve-hal-forms-fields.ts`'s label computation uses this exact same
 * classification rather than a second, potentially-drifting copy.
 */
export function directionLabel(sp: {
  searchType: string;
}): "After" | "Before" | "From" | "Until" | undefined {
  switch (sp.searchType) {
    case "greater-than":
      return "After";
    case "greater-than-or-equal":
      return "From";
    case "less-than":
      return "Before";
    case "less-than-or-equal":
      return "Until";
    default:
      return undefined;
  }
}
