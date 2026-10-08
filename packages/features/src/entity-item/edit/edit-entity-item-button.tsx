import { PencilSimpleIcon } from "@phosphor-icons/react";
import type { EntityItem } from "@contentgrid/navigator-data";
import { Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@contentgrid/ui";
import { isEditableEntityItem } from "./editable-entity-item";

/**
 * The Edit action for an item: a pencil on a filled primary-colored rounded box, with a tooltip. Rendered only when the item can be edited and isn't already.
 */
export function EditEntityItemButton({
  item,
  isEditing,
  onEdit,
}: Readonly<{ item: EntityItem; isEditing: boolean; onEdit: () => void }>) {
  if (isEditing || !isEditableEntityItem(item)) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="icon-sm"
            aria-label="Edit"
            onClick={onEdit}
            className="size-7 rounded-md"
          >
            <PencilSimpleIcon className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Edit</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
