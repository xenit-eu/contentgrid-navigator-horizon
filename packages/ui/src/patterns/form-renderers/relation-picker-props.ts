import type { ReactNode } from "react";
import type { EntityItemPickerColumn, EntityItemPickerOption } from "../entity-item-picker";
import type { RelationColumn } from "../relation-section";

/**
 * Props shared by `RelationToOneRenderer` and `RelationToManyRenderer` for
 * wiring the linked-item preview and the `EntityItemPicker` search dialog —
 * everything except the field/value/onChange/error trio, which differs by
 * cardinality.
 */
export interface RelationRendererPickerProps {
  /** Current page of candidates to link — fetched by the caller (packages/ui can't fetch). */
  readonly options: EntityItemPickerOption[];
  readonly isLoading: boolean;
  readonly searchQuery: string;
  readonly onSearch: (query: string) => void;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  /** href -> full attribute data for anything already linked or just selected, so
   * linked items can be shown with their real attributes rather than a bare id. */
  readonly selectedItemsData: Readonly<Record<string, Record<string, unknown>>>;
  /** Columns to show for linked items — attribute name/title pairs from the target profile. */
  readonly columns?: RelationColumn[];
  /** Called the moment a picker selection is made, so the caller can cache the item's data. */
  readonly onItemResolved: (href: string, data: Record<string, unknown>) => void;
  /** Rendered in the picker when provided — see EntityItemPicker's `createNewLink`. */
  readonly createNewLink?: ReactNode;
  /** Forwarded straight to `RelationSection`'s `onViewItem` — receives a linked item's href (this
   * is what `RelationSection`'s `RelationItem.id` is set to below). Omitted entirely (no "view
   * details" affordance) when not provided. */
  readonly onViewItem?: (href: string) => void;
}

/**
 * `RelationColumn` (`{key, title}`, used by `RelationSection`'s linked-item preview) and
 * `EntityItemPickerColumn` (`{key, header}`, used by `EntityItemPicker`'s search dialog) carry the same
 * caller-supplied column titles under different field names — without this conversion, a
 * `RelationToOneRenderer`/`RelationToManyRenderer` caller's `columns` only reached the preview,
 * leaving the picker dialog to fall back to its own auto-derived column headers for the same
 * relation, so the two could show different labels for the same attribute.
 */
export function toEntityPickerColumns(
  columns?: RelationColumn[],
): EntityItemPickerColumn[] | undefined {
  return columns?.map(({ key, title }) => ({ key, header: title }));
}

/** Looks up a just-selected option's own attribute data by href, for the `onItemResolved` call
 * both `RelationToOneRenderer` and `RelationToManyRenderer` make right after a picker selection —
 * falls back to `{}` since `onItemResolved`'s cache is keyed by href regardless of whether real
 * data was found (matches `RelationItem.data`'s existing `?? {}` fallback elsewhere). */
export function resolveOptionData(
  options: readonly EntityItemPickerOption[],
  href: string,
): Record<string, unknown> {
  return options.find((option) => option.href === href)?.data ?? {};
}
