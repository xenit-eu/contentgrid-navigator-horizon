import { toast } from "sonner";
import {
  type EntityItem,
  toProblemDisplayModel,
  useDeleteEntityItem,
} from "@contentgrid/navigator-data";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@contentgrid/ui";
import { ProblemAlert } from "../../problem-details";

export interface DeleteItemDialogProps {
  readonly item: EntityItem;
  readonly label: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called after the server confirmed the deletion. */
  readonly onDeleted: () => void;
}

/**
 * Confirmation for deleting an item from the graph (FR-029–FR-032). Uses `useDeleteEntityItem`
 * (template-driven request, If-Match from the item's ETag). On failure the dialog stays open and
 * shows the reason — e.g. `integrity/required-relation` when another item still requires it.
 */
export function DeleteItemDialog({
  item,
  label,
  open,
  onOpenChange,
  onDeleted,
}: Readonly<DeleteItemDialogProps>) {
  const mutation = useDeleteEntityItem({
    mutationOptions: {
      onSuccess: () => {
        toast.success(`${label} deleted`);
        onOpenChange(false);
        onDeleted();
      },
    },
  });
  const pending = mutation.isPending;

  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the {item.profileEntity.title.toLowerCase()}{" "}
            <strong>{label}</strong> itself, not just the link. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {mutation.error ? <ProblemAlert model={toProblemDisplayModel(mutation.error)} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={pending}
            onClick={() => mutation.mutate(item)}
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
