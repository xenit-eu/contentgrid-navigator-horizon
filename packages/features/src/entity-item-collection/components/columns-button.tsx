import { useState } from "react";
import { SlidersHorizontalIcon } from "@phosphor-icons/react";
import {
  AttributeMultiSelectContent,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type ProfileAttributeOption,
} from "@contentgrid/ui";

export interface ColumnsButtonProps {
  /** The attributes the user can show as columns. */
  readonly attributes: readonly ProfileAttributeOption[];
  /** Names of the attributes currently shown. */
  readonly visibleColumns: readonly string[];
  readonly onVisibleColumnsChange: (visibleColumns: readonly string[]) => void;
}

/** "Columns" button with a popover to pick which attributes the table shows. */
export function ColumnsButton({
  attributes,
  visibleColumns,
  onVisibleColumnsChange,
}: Readonly<ColumnsButtonProps>) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontalIcon aria-hidden />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-1" align="end">
        <AttributeMultiSelectContent
          attributes={attributes}
          values={visibleColumns}
          onChange={onVisibleColumnsChange}
        />
      </PopoverContent>
    </Popover>
  );
}
