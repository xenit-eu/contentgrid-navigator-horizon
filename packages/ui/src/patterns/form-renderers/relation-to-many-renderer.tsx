import { useState } from "react";
import type { FieldValue } from "@contentgrid/navigator-data/field-value";
import { EntityItemPicker } from "../entity-item-picker";
import { type RelationItem, RelationSection } from "../relation-section";
import {
  type RelationRendererPickerProps,
  resolveOptionData,
  toEntityPickerColumns,
} from "./relation-picker-props";

export interface RelationToManyRendererProps extends RelationRendererPickerProps {
  readonly name: string;
  readonly label: string;
  readonly required: boolean;
  readonly readOnly: boolean;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
  readonly error?: string;
}

/**
 * Wraps `RelationSection` (display + link/unlink) and `EntityItemPicker` (search dialog), with
 * `EntityItemPicker` in multi-select mode so several items can be linked from one popover open.
 * `EntityItemPicker.onSelect` fires exactly once per confirm, with every selected item's href
 * already collected — so the new hrefs are simply appended onto the current `value`.
 */
export function RelationToManyRenderer({
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
        title={label}
        required={required}
        items={items}
        columns={columns}
        onLink={readOnly ? undefined : () => setOpen(true)}
        onUnlink={readOnly ? undefined : (id) => onChange(hrefs.filter((href) => href !== id))}
        onViewItem={onViewItem}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <EntityItemPicker
        open={open}
        onOpenChange={setOpen}
        relationTitle={label}
        options={options.filter((option) => !hrefs.includes(option.href))}
        columns={toEntityPickerColumns(columns)}
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
            onItemResolved(href, resolveOptionData(options, href));
          }
        }}
      />
    </>
  );
}
