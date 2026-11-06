import { useState } from "react";
import { CircleNotchIcon, TrashIcon } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  type EntityItem,
  isProblemWithStatus,
  toProblemDisplayModel,
  useDeleteEntityItem,
} from "@contentgrid/navigator-data";
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
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@contentgrid/ui";
// Import from the specific file, we'd get circular imports when importing from "../entity-item"
import { EntityItemReference } from "../entity-item/variations/item-reference/entity-item-reference";
import { ProblemAlert } from "../problem-details";

export interface DeleteEntityItemButtonProps {
  readonly item: EntityItem;
  readonly onDeleted: () => void;
  readonly onRefresh: () => void;
  readonly label?: string;
}

export function DeleteEntityItemButton({
  item,
  onDeleted,
  onRefresh,
  label,
}: Readonly<DeleteEntityItemButtonProps>) {
  const [open, setOpen] = useState(false);
  const deleteMutation = useDeleteEntityItem({
    mutationOptions: {
      onSuccess: onDeleted,
      onError: (error) => {
        if (!isProblemWithStatus(error, 412)) {
          return;
        }
        onRefresh();
        setOpen(false);
        toast.warning("This item was changed by someone else.", {
          description: "Check the latest version and delete again.",
        });
      },
    },
  });
  // Stays busy after success too: the host is navigating away, the item is gone.
  const isBusy = deleteMutation.isPending || deleteMutation.isSuccess;

  // Project policy: hide operations whose template is absent, don't disable them.
  if (!item.canDelete) {
    return null;
  }

  function handleOpenChange(shouldOpen: boolean) {
    // Escape and Cancel can't close the dialog while the delete runs.
    if (isBusy) {
      return;
    }
    // A reopened dialog shouldn't show the previous attempt's problem.
    if (shouldOpen) {
      deleteMutation.reset();
    }
    setOpen(shouldOpen);
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      {/* No onclick on the buttons, that's what the wrapping AlertDialogTrigger is for */}
      {label ? (
        <AlertDialogTrigger asChild>
          <Button type="button" variant="destructive" size="sm">
            <TrashIcon />
            {label}
          </Button>
        </AlertDialogTrigger>
      ) : (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="destructive"
                  size="icon-sm"
                  aria-label="Delete"
                  className="size-7 rounded-md"
                >
                  <TrashIcon className="size-3.5" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">Delete</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete item</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p className="mb-2">Are you sure you want to delete this?</p>
              <EntityItemReference item={item} />
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.isError && !isProblemWithStatus(deleteMutation.error, 412) && (
          <ProblemAlert model={toProblemDisplayModel(deleteMutation.error)} />
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isBusy}
            onClick={(event) => {
              // Keep the dialog open: it closes by navigating away on success.
              event.preventDefault();
              deleteMutation.mutate(item);
            }}
          >
            {deleteMutation.isPending && (
              <CircleNotchIcon className="size-4 animate-spin" aria-hidden />
            )}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
