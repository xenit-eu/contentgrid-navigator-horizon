import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../primitives/alert-dialog";

export interface UnsavedChangesDialogProps {
  /** Renders the dialog when true — e.g. a route navigation was blocked by a dirty form. */
  readonly open: boolean;
  /** Called when the user confirms leaving. */
  readonly onConfirm: () => void;
  /** Called when the user cancels — the Stay button, overlay click, or Escape. */
  readonly onCancel: () => void;
}

/**
 * Confirmation dialog for leaving a page with unsaved changes. Pure presentation — no
 * router or form-state knowledge — so it stays reusable outside its current caller
 * (`useUnsavedChangesGuard` in packages/features, which owns deciding *when* to open it).
 */
export function UnsavedChangesDialog({
  open,
  onConfirm,
  onCancel,
}: Readonly<UnsavedChangesDialogProps>) {
  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes. If you leave this page now, they will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Leave
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
