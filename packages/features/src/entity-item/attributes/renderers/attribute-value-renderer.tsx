import {
  AttributeKind,
  type EntityItemAttribute,
  ProfileAttributeType,
} from "@contentgrid/navigator-data";
import { defaultAttributeRendererComponents } from "./registry";

/** Shared default for hard-truncating table-cell text — see `maxCharLength` below. */
export const TABLE_ATTRIBUTE_MAX_CHAR_LENGTH = 80;

export interface AttributeValueRendererProps {
  readonly attr: EntityItemAttribute;
  /**
   * Wrap onto multiple lines instead of truncating with an ellipsis. Only
   * applied to renderers whose props support it — passing it through has no
   * effect on kinds that don't (content, unknown, boolean, number).
   */
  readonly wrap?: boolean;
  /**
   * Selects the presentation for compact/tabular contexts:
   * - `"default"` (default) — the current label-prefixed chip look, used by
   *   the audit timeline and relation previews.
   * - `"item-reference"` — for `EntityItemReference` titles/subtitles: same
   *   chip look for Creator/Modifier but without the attribute-name prefix.
   * - `"table"` — for `EntityItemCollectionTable` columns and the detail
   *   view's attribute table: plain, single-color text (no chips, no
   *   backgrounds); only a user icon or a date icon may accompany the text.
   */
  readonly variant?: "default" | "item-reference" | "table";
  /** Hard-truncates long string values to this many characters (plus an ellipsis). Only applied to plain string attributes. */
  readonly maxCharLength?: number;
}

/**
 * Renders just an attribute's value (no label) — for compact contexts that
 * already show the attribute label separately (relation previews, reference
 * titles, and the main attribute table). Nested/object attributes render
 * nothing.
 */
export function AttributeValueRenderer({
  attr,
  wrap,
  variant = "default",
  maxCharLength,
}: Readonly<AttributeValueRendererProps>) {
  const components = defaultAttributeRendererComponents;

  if (attr.value.kind === AttributeKind.CONTENT) {
    return <components.content metadata={attr.value.metadata} />;
  }
  if (attr.value.kind === AttributeKind.NESTED) {
    return null;
  }
  if (attr.value.kind === AttributeKind.UNKNOWN) {
    return <components.unknown />;
  }

  if (attr.profileAttribute?.isCreatedDate) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return (
      <components.createdDate
        value={attr.value.value as string | null}
        label={label}
        wrap={wrap}
        variant={variant}
        type={
          attr.profileAttribute.type as ProfileAttributeType.date | ProfileAttributeType.datetime
        }
      />
    );
  }
  if (attr.profileAttribute?.isModifiedDate) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return (
      <components.modifiedDate
        value={attr.value.value as string | null}
        label={label}
        wrap={wrap}
        variant={variant}
        type={
          attr.profileAttribute.type as ProfileAttributeType.date | ProfileAttributeType.datetime
        }
      />
    );
  }
  if (attr.profileAttribute?.isCreatedBy) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return (
      <components.createdBy value={attr.value.value} label={label} wrap={wrap} variant={variant} />
    );
  }
  if (attr.profileAttribute?.isModifiedBy) {
    const label = attr.profileAttribute.title ?? attr.profileAttribute.name;
    return (
      <components.modifiedBy value={attr.value.value} label={label} wrap={wrap} variant={variant} />
    );
  }

  const type = attr.profileAttribute?.type;
  if (type === ProfileAttributeType.boolean) {
    const value = attr.value.value as boolean | null;
    // In the item-reference variant the chip stands alone (e.g. as an EntityItemReference
    // title/subtitle) with no separate label nearby, so it shows the attribute's own name —
    // same as the boolean chip row in EntityItemAttributes — rather than the value.
    const label =
      variant === "item-reference"
        ? (attr.profileAttribute?.title ?? attr.profileAttribute?.name ?? "")
        : value === true
          ? "Yes"
          : value === false
            ? "No"
            : "Not set";
    return <components.boolean value={value} label={label} variant={variant} />;
  }
  if (type === ProfileAttributeType.long || type === ProfileAttributeType.double) {
    return <components.number value={attr.value.value as number | null} type={type} />;
  }
  if (type === ProfileAttributeType.date) {
    return <components.date value={attr.value.value as string | null} wrap={wrap} />;
  }
  if (type === ProfileAttributeType.datetime) {
    return <components.datetime value={attr.value.value as string | null} wrap={wrap} />;
  }
  return <components.string value={attr.value.value} wrap={wrap} maxCharLength={maxCharLength} />;
}
