import { Fragment, type ReactNode, useState } from "react";
import { DotsThreeVerticalIcon as DotsThreeVertical } from "@phosphor-icons/react";
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
import { Button } from "../../primitives/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../primitives/dropdown-menu";

export interface RecordRowMenuItem {
  readonly key: string;
  readonly label: string;
  readonly icon?: ReactNode;
  /** Called when the item is chosen; for an item with `confirm`, once the dialog is confirmed. */
  readonly onSelect: () => void;
  /** Shows the item in the destructive colour. */
  readonly destructive?: boolean;
  /** Draws a separator above the item. */
  readonly separatorBefore?: boolean;
  readonly disabled?: boolean;
  /** Asks first: choosing the item opens a confirmation dialog instead of calling `onSelect`. */
  readonly confirm?: {
    readonly title: string;
    readonly description: ReactNode;
    readonly actionLabel: string;
  };
}

export interface RecordRowMenuProps {
  /** Accessible name of the trigger button, e.g. "Actions for INV-2026-04812". */
  readonly label: string;
  readonly items: readonly RecordRowMenuItem[];
  /** Starts with the menu open, e.g. for a story that shows it. */
  readonly defaultOpen?: boolean;
}

/**
 * A `RecordTableRow` actions menu: one "⋮" icon button that opens a dropdown of the row's
 * actions, bordered while it is open. Neither opening the menu, choosing an item nor the
 * confirmation dialog reaches the row's own click. Renders nothing without items.
 */
function RecordRowMenu({ label, items, defaultOpen }: Readonly<RecordRowMenuProps>) {
  const [confirming, setConfirming] = useState<RecordRowMenuItem>();

  if (items.length === 0) return null;

  return (
    <>
      {/* Non-modal: a modal menu leaves `pointer-events: none` on the body when the confirmation dialog opens as it closes. */}
      <DropdownMenu defaultOpen={defaultOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="border border-transparent data-[state=open]:border-border data-[state=open]:bg-background"
            onClick={(event) => event.stopPropagation()}
          >
            <DotsThreeVertical weight="bold" className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-44"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {items.map((item) => (
            <Fragment key={item.key}>
              {item.separatorBefore && <DropdownMenuSeparator />}
              <DropdownMenuItem
                variant={item.destructive ? "destructive" : "default"}
                disabled={item.disabled}
                onSelect={() => (item.confirm ? setConfirming(item) : item.onSelect())}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={confirming !== undefined}
        onOpenChange={(open) => !open && setConfirming(undefined)}
      >
        {confirming?.confirm && (
          <AlertDialogContent size="sm" onClick={(event) => event.stopPropagation()}>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirming.confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirming.confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant={confirming.destructive ? "destructive" : "default"}
                onClick={confirming.onSelect}
              >
                {confirming.confirm.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </>
  );
}

export { RecordRowMenu };
