import type { ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../primitives/alert-dialog";
import { Button } from "../../primitives/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../primitives/tooltip";

export interface RecordRowConfirmActionProps {
  /** Tooltip, accessible name, and confirm button label. */
  readonly label: string;
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: ReactNode;
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
}

/** A `RecordTableRow` action icon button that confirms (e.g. Unlink, Delete) before firing. */
function RecordRowConfirmAction({
  label,
  icon,
  title,
  description,
  onConfirm,
  disabled,
}: Readonly<RecordRowConfirmActionProps>) {
  return (
    <AlertDialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={(event) => event.stopPropagation()}
              >
                {icon}
                <span className="sr-only">{label}</span>
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialogContent size="sm" onClick={(event) => event.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { RecordRowConfirmAction };
