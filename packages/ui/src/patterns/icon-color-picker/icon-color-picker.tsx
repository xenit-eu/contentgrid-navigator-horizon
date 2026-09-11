import { cn } from "../../lib/utils";
import { Separator } from "../../primitives/separator";
import { ColorPickerContent } from "../color-picker/color-picker";
import { IconPickerContent } from "../icon-picker/icon-picker";

export interface IconColorPickerContentProps {
  /** Currently selected icon name (one of `ENTITY_ICON_OPTIONS`), or `undefined` if unset. */
  readonly icon: string | undefined;
  /** Called with the selected icon's `name` when the user picks one. */
  readonly onIconChange: (name: string) => void;
  /** Currently selected CSS color (any valid `color` value), or `undefined` if unset. */
  readonly color: string | undefined;
  /** Called with the new CSS color when a preset swatch is picked. */
  readonly onColorChange: (color: string) => void;
  readonly className?: string;
}

/**
 * Icon and color pickers combined into a single popover's worth of content — no popover
 * chrome of its own, so the caller supplies the trigger (e.g. a clickable `IconBadge`) and
 * wraps this in `Popover` / `PopoverTrigger` / `PopoverContent`.
 */
export function IconColorPickerContent({
  icon,
  onIconChange,
  color,
  onColorChange,
  className,
}: Readonly<IconColorPickerContentProps>) {
  return (
    <div className={cn("space-y-3", className)}>
      <ColorPickerContent value={color} onChange={onColorChange} />
      <Separator />
      <IconPickerContent value={icon} onChange={onIconChange} />
    </div>
  );
}
