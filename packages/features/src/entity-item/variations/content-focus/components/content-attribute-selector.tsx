import { PaperclipIcon } from "@phosphor-icons/react";
import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";
import { AttributeSelect, type ProfileAttributeOption } from "@contentgrid/ui";

export interface ContentAttributeSelectorProps {
  readonly entityItem: EntityItem;
  /** Currently selected content attribute name. */
  readonly value: string;
  /** Fires with the newly selected attribute's name. */
  readonly onChange: (attributeName: string) => void;
}

/**
 * `ContentAttributeOptionSelector` over the item's content attributes.
 *
 * Lists every content attribute the item has, not only ones that currently hold a file — an
 * attribute that needs uploading or that errors out while loading is still a valid switch target.
 */
export function ContentAttributeSelector({
  entityItem,
  value,
  onChange,
}: Readonly<ContentAttributeSelectorProps>) {
  const options: ProfileAttributeOption[] = entityItem.attributes.flatMap((attr) => {
    if (attr.value.kind !== AttributeKind.CONTENT) {
      return [];
    }
    return [{ name: attr.value.name, title: attr.profileAttribute?.title, type: "content" }];
  });

  return <ContentAttributeOptionSelector options={options} value={value} onChange={onChange} />;
}

interface ContentAttributeOptionSelectorProps {
  readonly options: readonly ProfileAttributeOption[];
  /** Currently selected option name. */
  readonly value: string;
  /** Fires with the newly selected option's name. Without it the title is shown as plain text. */
  readonly onChange?: (attributeName: string) => void;
}

/**
 * `AttributeSelect` over a given list of content attributes, rendered in a preview toolbar's
 * `start` slot at compact (`size="sm"`) height to match the toolbar's other controls. Takes the
 * options directly, so it also serves a caller that has no `EntityItem`.
 *
 * Renders nothing when there are no options. With exactly one option, or without `onChange`, there
 * is nothing to pick here, so it shows the selected option's title in a pill with a paperclip icon:
 * the user still sees which attribute is on screen, without a control that does nothing.
 */
export function ContentAttributeOptionSelector({
  options,
  value,
  onChange,
}: Readonly<ContentAttributeOptionSelectorProps>) {
  if (options.length === 0) {
    return null;
  }

  if (!onChange || options.length === 1) {
    const selected = options.find((option) => option.name === value);
    // A pill with the selector trigger's fill and border, so the toolbar looks alike either way; a
    // label, not a control, so it has no hover or chevron.
    return (
      <span className="border-input text-muted-foreground dark:bg-input/30 flex min-w-0 items-center gap-1.5 rounded-full border bg-transparent px-2.5 py-1 text-sm font-medium">
        <PaperclipIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{selected?.title ?? value}</span>
      </span>
    );
  }

  return (
    // `AttributeSelect`'s trigger is `w-full` — it's designed to fill a labeled form field's
    // column, not a flex row. Bound it to a fixed width so it sits inline in the PDF viewer
    // toolbar (`start` slot, `pdf-viewer-toolbar.tsx`) alongside page navigation and zoom
    // controls instead of fighting them for flex space.
    <div className="w-44">
      <AttributeSelect
        size="sm"
        attributes={options}
        value={value}
        onSelect={(attribute) => onChange(attribute.name)}
        placeholder="Content attribute"
      />
    </div>
  );
}
