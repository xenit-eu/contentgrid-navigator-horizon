import type { ProfileRelation, SearchHalFormTemplate } from "@contentgrid/navigator-data";
import type { HalFormsField } from "./hal-forms-field";
import type { FieldRow, FieldSection, LayoutSchema } from "./layout-schema";

/**
 * FR-018/019/020, FR-028: a search form's default layout schema when no explicit one is
 * supplied. Pairs a property's `~before`/`~after` range variants onto one row wherever both
 * survived into `fields`; every other field — including a datetime/date attribute's own
 * exact-match property, which `resolve-hal-forms-fields.ts` deliberately keeps alongside its
 * `~before`/`~after` siblings rather than suppressing as redundant — gets its own full-width row,
 * in `fields` order. Only a field that is itself one of the two range/direction variants (i.e.
 * has a `directionLabel`) is eligible for pairing; an exact-match sibling sharing the same
 * `groupKey` never gets swept into that pair, so it renders as its own row, with the paired
 * range row immediately below it (in `fields` order). Rows are then grouped into sections
 * (FR-028): every relation-traversal property (e.g.
 * "customer.name") is placed into a collapsible section named for its relation, one section per
 * relation, in first-appearance order; every direct (non-relation) property stays in a single
 * plain, non-collapsible leading section — the same flat shape this generator always produced,
 * before sections could carry a title.
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
  const groupKeyByName = new Map(
    searchTemplate.searchProperties.map((sp) => [sp.property.name, sp.groupKey] as const),
  );
  const directionLabelByName = new Map(
    searchTemplate.searchProperties.map((sp) => [sp.property.name, directionLabel(sp)] as const),
  );
  const relationByName = new Map(
    searchTemplate.searchProperties.map(
      (sp) => [sp.property.name, sp.isOverRelation ? sp.profileRelation : undefined] as const,
    ),
  );

  const rangeSiblingsByGroupKey = new Map<string, HalFormsField[]>();
  for (const field of fields) {
    if (directionLabelByName.get(field.name) === undefined) continue;
    const groupKey = groupKeyByName.get(field.name);
    if (groupKey === undefined) continue;
    const siblings = rangeSiblingsByGroupKey.get(groupKey) ?? [];
    siblings.push(field);
    rangeSiblingsByGroupKey.set(groupKey, siblings);
  }

  const rows: { fieldNames: string[]; relation: ProfileRelation | undefined }[] = [];
  const placedNames = new Set<string>();

  for (const field of fields) {
    if (placedNames.has(field.name)) continue;

    const isRangeField = directionLabelByName.get(field.name) !== undefined;
    const groupKey = groupKeyByName.get(field.name);
    const rangeSiblings =
      isRangeField && groupKey !== undefined ? rangeSiblingsByGroupKey.get(groupKey) : undefined;

    if (rangeSiblings?.length === 2) {
      const names = rangeSiblings.map((sibling) => sibling.name);
      rows.push({ fieldNames: names, relation: relationByName.get(field.name) });
      names.forEach((name) => placedNames.add(name));
      continue;
    }

    rows.push({ fieldNames: [field.name], relation: relationByName.get(field.name) });
    placedNames.add(field.name);
  }

  return { sections: groupRowsIntoSections(rows) };
}

/**
 * FR-028: buckets already-paired rows into a leading, plain section for every direct property
 * plus one collapsible, relation-titled section per relation — in the relation's first
 * appearance order among `rows`, not alphabetical or profile-declaration order, so a caller
 * sees sections in the same order the fields themselves would have appeared in a flat layout.
 *
 * A relation section's `description` is the relation's own `ProfileRelation.description` — shown
 * once, on the section header, not on every field inside it. `searchPropertyHalFormsField`
 * (`resolve-hal-forms-fields.ts`) deliberately does NOT fall back to `profileRelation.description`
 * for an individual field's own `description` any more, precisely so the two don't duplicate the
 * same text at both levels.
 */
function groupRowsIntoSections(
  rows: readonly { fieldNames: readonly string[]; relation: ProfileRelation | undefined }[],
): FieldSection[] {
  const directRows: FieldRow[] = [];
  const relationOrder: string[] = [];
  const relationsByKey = new Map<string, ProfileRelation>();
  const rowsByRelationKey = new Map<string, FieldRow[]>();

  for (const row of rows) {
    if (!row.relation) {
      directRows.push({ fieldNames: row.fieldNames });
      continue;
    }

    const key = row.relation.name;
    if (!relationsByKey.has(key)) {
      relationsByKey.set(key, row.relation);
      rowsByRelationKey.set(key, []);
      relationOrder.push(key);
    }
    rowsByRelationKey.get(key)!.push({ fieldNames: row.fieldNames });
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
