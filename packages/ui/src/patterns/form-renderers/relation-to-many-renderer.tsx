import { useState } from "react";
import type { FieldValue, RenderFieldDescriptor } from "@contentgrid/navigator-data/schema";
import { EntityPicker } from "../entity-picker";
import { type RelationItem, RelationSection } from "../relation-section";
import type { RelationRendererPickerProps } from "./relation-picker-props";

export interface RelationToManyRendererProps extends RelationRendererPickerProps {
  readonly field: Extract<RenderFieldDescriptor, { type: "relation-to-many" }>;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

/**
 * Wraps `RelationSection` (display + link/unlink) and `EntityPicker` (search dialog), with
 * `EntityPicker` in multi-select mode so several items can be linked from one popover open.
 * `EntityPicker.onSelect` fires exactly once per confirm, with every selected item's href
 * already collected — so the new hrefs are simply appended onto the current `value`.
 */
export function RelationToManyRenderer({
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
}: Readonly<RelationToManyRendererProps>) {
  const [open, setOpen] = useState(false);
  const hrefs = Array.isArray(value) ? (value as string[]) : [];
  const items: RelationItem[] = hrefs.map((href) => ({
    id: href,
    data: selectedItemsData[href] ?? {},
  }));

  return (
    <>
      <RelationSection
        title={field.label}
        required={field.required}
        items={items}
        columns={columns}
        onLink={field.readOnly ? undefined : () => setOpen(true)}
        onUnlink={
          field.readOnly ? undefined : (id) => onChange(hrefs.filter((href) => href !== id))
        }
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <EntityPicker
        open={open}
        onOpenChange={setOpen}
        relationTitle={field.label}
        options={options.filter((option) => !hrefs.includes(option.href))}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onSearch={onSearch}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
        createNewLink={createNewLink}
        multiSelect
        onSelect={(selectedHrefs) => {
          onChange([...hrefs, ...selectedHrefs]);
          for (const href of selectedHrefs) {
            onItemResolved(href, options.find((o) => o.href === href)?.data ?? {});
          }
        }}
      />
    </>
  );
}
