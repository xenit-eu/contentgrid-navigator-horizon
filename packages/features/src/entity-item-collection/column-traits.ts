import { type ProfileAttribute, ProfileAttributeType } from "@contentgrid/navigator-data";
import type { RecordTableColumn } from "@contentgrid/ui";

/**
 * What a table column holds, from its profile attribute: drives the sort tooltip wording and the
 * alignment of numbers. No attribute (the `id` column) counts as text; a type with no natural
 * sort wording (boolean, content) gets no `sortKind`.
 */
export function columnTraits(
  attribute: ProfileAttribute | undefined,
): Pick<RecordTableColumn, "sortKind" | "align"> {
  switch (attribute?.type) {
    case ProfileAttributeType.long:
    case ProfileAttributeType.double:
      return { sortKind: "number", align: "end" };
    case ProfileAttributeType.date:
    case ProfileAttributeType.datetime:
      return { sortKind: "date" };
    case ProfileAttributeType.string:
    case ProfileAttributeType.stringSet:
    case undefined:
      return { sortKind: "text" };
    default:
      return {};
  }
}
