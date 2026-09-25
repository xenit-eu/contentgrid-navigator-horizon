import type {
  ProfileRelation,
  SearchHalFormTemplate,
  SearchHalFormTemplateProperty,
} from "@contentgrid/navigator-data";
import { formatFieldName } from "../../format-field-name";
import type { HalFormsField } from "./hal-forms-field";
import type { FieldRow, FieldSection, FieldSectionItem, LayoutSchema } from "./layout-schema";

/**
 * FR-018/019/020, FR-028: a search form's default layout schema when no explicit one is
 * supplied.
 *
 * Every attribute with at least one surviving range variant (`~gte`/`~lte`/`~after`/`~before`/…)
 * gets its own nested, non-collapsible section, titled and described by the attribute
 * (`rangeAttributeSection`). Inside it, the attribute's other variants (e.g. its exact-match
 * property, labelled "Equals" by `resolve-hal-forms-fields.ts`) come first, one per row, then
 * the range variants — paired onto one row when both bounds survived, else one per row. The
 * range fields are labelled only by direction ("From"/"Until"), so the section title is what
 * tells two range attributes apart. The nested section sits where the attribute's first field
 * appears in `fields`; every other field gets its own full-width row, in `fields` order.
 *
 * Items are then grouped into sections (FR-028): every relation-traversal property (e.g.
 * "customer.name") is placed into a collapsible section named for its relation, one section per
 * relation, in first-appearance order — a relation's range attribute becomes a nested section
 * inside it; every direct (non-relation) property stays in a single plain, non-collapsible
 * leading section.
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

  const items: RelationScopedItem[] = [];
  const placedNames = new Set<string>();

  for (const field of fields) {
    if (placedNames.has(field.name)) continue;

    const sp = searchPropertyByName.get(field.name);
    const relation = sp?.isOverRelation ? sp.profileRelation : undefined;
    const siblings = sp ? (fieldsByGroupKey.get(sp.groupKey) ?? []) : [];
    const rangeFields = siblings.filter(isRangeField);

    if (sp && rangeFields.length > 0) {
      const otherFields = siblings.filter((sibling) => !isRangeField(sibling));
      items.push({ item: rangeAttributeSection(sp, otherFields, rangeFields), relation });
      siblings.forEach((sibling) => placedNames.add(sibling.name));
      continue;
    }

    items.push({ item: { fieldNames: [field.name] }, relation });
    placedNames.add(field.name);
  }

  return { sections: groupItemsIntoSections(items) };
}

interface RelationScopedItem {
  readonly item: FieldSectionItem;
  readonly relation: ProfileRelation | undefined;
}

/**
 * One range attribute's nested section. Its title is the attribute, not `property.prompt` —
 * that names a single variant (e.g. "Age : From"). A relation-traversal property is titled
 * "{Relation} : {Attribute}" (e.g. "Friends : Age"); it never resolves a `profileAttribute`
 * (see `SearchHalFormTemplateProperty`), so the attribute part falls back to the last
 * `groupKey` segment. The attribute description lives here, once, instead of under each of the
 * section's fields.
 */
function rangeAttributeSection(
  sp: SearchHalFormTemplateProperty,
  otherFields: readonly HalFormsField[],
  rangeFields: readonly HalFormsField[],
): FieldSection {
  const { profileAttribute, groupKey } = sp;
  const attributeTitle =
    profileAttribute?.title ?? formatFieldName(groupKey.slice(groupKey.lastIndexOf(".") + 1));
  const relationTitle = sp.isOverRelation ? sp.profileRelation?.title : undefined;
  const rangeRows: FieldRow[] =
    rangeFields.length === 2
      ? [{ fieldNames: rangeFields.map((field) => field.name) }]
      : rangeFields.map((field) => ({ fieldNames: [field.name] }));
  return {
    title: relationTitle ? `${relationTitle} : ${attributeTitle}` : attributeTitle,
    description: profileAttribute?.description || undefined,
    rows: [...otherFields.map((field) => ({ fieldNames: [field.name] })), ...rangeRows],
  };
}

/**
 * FR-028: buckets items into a leading, plain section for every direct property plus one
 * collapsible, relation-titled section per relation — in the relation's first appearance order
 * among `items`, not alphabetical or profile-declaration order, so a caller sees sections in the
 * same order the fields themselves would have appeared in a flat layout.
 *
 * A relation section's `description` is the relation's own `ProfileRelation.description` — shown
 * once, on the section header, not on every field inside it. `searchPropertyHalFormsField`
 * (`resolve-hal-forms-fields.ts`) deliberately does NOT fall back to `profileRelation.description`
 * for an individual field's own `description` any more, precisely so the two don't duplicate the
 * same text at both levels.
 */
function groupItemsIntoSections(items: readonly RelationScopedItem[]): FieldSection[] {
  const directItems: FieldSectionItem[] = [];
  const relationOrder: string[] = [];
  const relationsByKey = new Map<string, ProfileRelation>();
  const itemsByRelationKey = new Map<string, FieldSectionItem[]>();

  for (const { item, relation } of items) {
    if (!relation) {
      directItems.push(item);
      continue;
    }

    const key = relation.name;
    if (!relationsByKey.has(key)) {
      relationsByKey.set(key, relation);
      itemsByRelationKey.set(key, []);
      relationOrder.push(key);
    }
    itemsByRelationKey.get(key)!.push(item);
  }

  const sections: FieldSection[] = [];
  if (directItems.length > 0) sections.push({ rows: directItems });
  for (const key of relationOrder) {
    const relation = relationsByKey.get(key)!;
    sections.push({
      title: relation.title,
      description: relation.description || undefined,
      isCollapsible: true,
      rows: itemsByRelationKey.get(key)!,
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
