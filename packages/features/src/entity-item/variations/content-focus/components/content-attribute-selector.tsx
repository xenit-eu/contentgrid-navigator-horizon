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
 * `AttributeSelect` (`@contentgrid/ui`'s shared profile-attribute selector pattern, round-2
 * review — reuse it instead of a hand-rolled `Select`) over the item's content attributes,
 * rendered in the PDF viewer toolbar's `start` slot at compact (`size="sm"`) height to match the
 * toolbar's other controls.
 *
 * Lists every content attribute the item has, not only ones that currently hold a file — an
 * attribute that needs uploading or that errors out while loading is still a valid switch target
 * (round-2 review: "cannot look or switch content attributes when one cannot be opened or needs
 * to be uploaded"). Renders nothing when there are no content attributes at all. With exactly one,
 * renders it as a *disabled* selector rather than nothing — same as the old Navigator's greyed-out
 * "Order document" box — so the user still has context on what they're viewing (round-2 review of
 * #192: "instead of returning null I would prefer a disabled selector that still displays the
 * default content attribute"). With two or more, renders the normal enabled selector.
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

  if (options.length === 0) {
    return null;
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
        disabled={options.length === 1}
      />
    </div>
  );
}
