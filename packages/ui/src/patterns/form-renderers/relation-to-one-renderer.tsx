import { useState } from "react";
import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { EntityPicker } from "../entity-picker";
import { type RelationItem, RelationSection } from "../relation-section";
import type { RelationRendererPickerProps } from "./relation-picker-props";

export interface RelationToOneRendererProps extends RelationRendererPickerProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

/**
 * Wraps the existing `RelationSection` (display + link/unlink) and `EntityPicker`
 * (search dialog) patterns — both already presentation-only/controlled — instead
 * of building new selection chrome from scratch.
 */
export function RelationToOneRenderer({
  label,
  required,
  readOnly,
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
  onViewItem,
}: Readonly<RelationToOneRendererProps>) {
  const [open, setOpen] = useState(false);
  const href = typeof value === "string" && value !== "" ? value : undefined;
  const items: RelationItem[] = href ? [{ id: href, data: selectedItemsData[href] ?? {} }] : [];

  return (
    <>
      <RelationSection
        title={label}
        required={required}
        isManyToOne
        items={items}
        columns={columns}
        onLink={readOnly ? undefined : () => setOpen(true)}
        onUnlink={readOnly ? undefined : () => onChange(undefined)}
        onViewItem={onViewItem}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <EntityPicker
        open={open}
        onOpenChange={setOpen}
        relationTitle={label}
        options={options}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearch={onSearch}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        createNewLink={createNewLink}
        onSelect={([selectedHref]) => {
          if (!selectedHref) return;
          onChange(selectedHref);
          onItemResolved(selectedHref, options.find((o) => o.href === selectedHref)?.data ?? {});
        }}
      />
    </>
  );
}
