import type { ReactNode } from "react";
import { Button } from "../../primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../primitives/tooltip";

export interface RecordRowActionProps {
  /** Tooltip and accessible name. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}

/** A `RecordTableRow` action icon button with a tooltip; its click never reaches the row. */
function RecordRowAction({ label, icon, onClick, disabled }: Readonly<RecordRowActionProps>) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
          >
            {icon}
            <span className="sr-only">{label}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { RecordRowAction };
