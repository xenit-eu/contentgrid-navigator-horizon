import { type ReactNode, useState } from "react";
import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { EntityPicker, type EntityPickerOption } from "../entity-picker";
import { type RelationColumn, type RelationItem, RelationSection } from "../relation-section";

export interface RelationToOneRendererProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "relation-to-one" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
  /** Current page of candidates to link — fetched by the caller (packages/ui can't fetch). */
  readonly options: EntityPickerOption[];
  readonly isLoading: boolean;
  readonly searchQuery: string;
  readonly onSearch: (query: string) => void;
  readonly hasPreviousPage: boolean;
  readonly hasNextPage: boolean;
  readonly onPreviousPage: () => void;
  readonly onNextPage: () => void;
  /** href -> full attribute data for anything already linked or just selected, so the
   * linked item can be shown with its real attributes rather than a bare id. */
  readonly selectedItemsData: Readonly<Record<string, Record<string, unknown>>>;
  /** Columns to show for the linked item — attribute name/title pairs from the target profile. */
  readonly columns?: RelationColumn[];
  /** Called the moment a picker selection is made, so the caller can cache the item's data. */
  readonly onItemResolved: (href: string, data: Record<string, unknown>) => void;
  /** Rendered in the picker when provided — see EntityPicker's `createNewLink`. */
  readonly createNewLink?: ReactNode;
}

/**
 * Wraps the existing `RelationSection` (display + link/unlink) and `EntityPicker`
 * (search dialog) patterns — both already presentation-only/controlled — instead
 * of building new selection chrome from scratch.
 */
export function RelationToOneRenderer({
  field,
  value,
  onChange,
  error,
  options,
  isLoading,
  searchQuery,
  onSearch,
  hasPreviousPage,
  hasNextPage,
  onPreviousPage,
  onNextPage,
  selectedItemsData,
  columns,
  onItemResolved,
  createNewLink,
}: Readonly<RelationToOneRendererProps>) {
  const [open, setOpen] = useState(false);
  const href = typeof value === "string" && value !== "" ? value : undefined;
  const items: RelationItem[] = href ? [{ id: href, data: selectedItemsData[href] ?? {} }] : [];

  return (
    <>
      <RelationSection
        title={field.label}
        required={field.required}
        isManyToOne
        items={items}
        columns={columns}
        onLink={field.readOnly ? undefined : () => setOpen(true)}
        onUnlink={field.readOnly ? undefined : () => onChange(undefined)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <EntityPicker
        open={open}
        onOpenChange={setOpen}
        relationTitle={field.label}
        options={options}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearch={onSearch}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        createNewLink={createNewLink}
        onSelect={(selectedHref) => {
          onChange(selectedHref);
          onItemResolved(selectedHref, options.find((o) => o.href === selectedHref)?.data ?? {});
          setOpen(false);
        }}
      />
    </>
  );
}
