import { useState } from "react";
import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { EntityPicker } from "../entity-picker";
import { type RelationItem, RelationSection } from "../relation-section";
import type { RelationRendererPickerProps } from "./relation-picker-props";

export interface RelationToOneRendererProps extends RelationRendererPickerProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "relation-to-one" }>;
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
        onSelect={([selectedHref]) => {
          if (!selectedHref) return;
          onChange(selectedHref);
          onItemResolved(selectedHref, options.find((o) => o.href === selectedHref)?.data ?? {});
        }}
      />
    </>
  );
}
