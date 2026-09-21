import { PaperclipIcon } from "@phosphor-icons/react";
import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@contentgrid/ui";

export interface ContentAttributeSelectorProps {
  readonly entityItem: EntityItem;
  /** Currently selected content attribute name. */
  readonly value: string;
  /** Fires with the newly selected attribute's name. */
  readonly onChange: (attributeName: string) => void;
}

/**
 * `Select` over the item's content attributes that currently hold a file (FR-004), rendered in
 * the PDF viewer toolbar's `start` slot. Renders nothing when at most one such attribute exists
 * — a lone option needs no selector.
 */
export function ContentAttributeSelector({
  entityItem,
  value,
  onChange,
}: Readonly<ContentAttributeSelectorProps>) {
  const options = entityItem.attributes.flatMap((attr) => {
    if (attr.value.kind !== AttributeKind.CONTENT || attr.value.metadata === null) {
      return [];
    }
    return [{ name: attr.value.name, label: attr.profileAttribute?.title ?? attr.value.name }];
  });

  if (options.length <= 1) {
    return null;
  }

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label="Content attribute">
        <PaperclipIcon className="size-4" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.name} value={option.name}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
