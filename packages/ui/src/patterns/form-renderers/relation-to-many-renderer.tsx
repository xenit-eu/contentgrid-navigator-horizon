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
 * Wraps `RelationSection` (display + link/unlink) and `EntityPicker` (search
 * dialog). One item is added per popover open — `EntityPicker` stays
 * single-select here, matching the existing detail-page "Add" flow, and
 * avoiding a stale-closure bug: `EntityPicker`'s multi-select path calls
 * `onSelect` once per item synchronously before any re-render, so
 * accumulating `[...value, href]` off the `value` prop across those calls
 * would drop all but the last href.
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
        onSelect={(href) => {
          if (!hrefs.includes(href)) onChange([...hrefs, href]);
          onItemResolved(href, options.find((o) => o.href === href)?.data ?? {});
          setOpen(false);
        }}
      />
    </>
  );
}
