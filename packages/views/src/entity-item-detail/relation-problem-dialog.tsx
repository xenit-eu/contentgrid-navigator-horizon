import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@contentgrid/ui";

export type RelationProblemDialogState =
  | { readonly kind: "missingRelationTarget"; readonly url: string; readonly field?: string }
  | {
      readonly kind: "blindRelationOverwrite";
      readonly existingItem?: string;
      readonly existingRelation?: string;
      readonly newItem?: string;
      readonly newRelation?: string;
    }
  | { readonly kind: "requiredRelation"; readonly affectedRelation: string };

/**
 * The default handling for the relation mutation problems the item feature surfaces
 * (`missing-relation-target`, `blind-relation-overwrite`, `required-relation`): show what the
 * problem body actually said, since there is no dedicated resolution flow yet.
 */
export function RelationProblemDialog({
  state,
  onOpenChange,
}: Readonly<{
  state: RelationProblemDialogState | null;
  onOpenChange: (open: boolean) => void;
}>) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {state?.kind === "missingRelationTarget" && (
          <>
            <DialogHeader>
              <DialogTitle>Linked item not found</DialogTitle>
              <DialogDescription>
                {state.field && <>Field &ldquo;{state.field}&rdquo;: </>}
                The item this relation points to no longer exists.
              </DialogDescription>
            </DialogHeader>
            <p className="break-all text-sm text-muted-foreground">{state.url}</p>
          </>
        )}
        {state?.kind === "blindRelationOverwrite" && (
          <>
            <DialogHeader>
              <DialogTitle>Relation already linked</DialogTitle>
              <DialogDescription>
                This relation already points at a different item. Unlink it first, then set the new
                one.
              </DialogDescription>
            </DialogHeader>
            <dl className="space-y-2 text-sm">
              {state.existingItem && (
                <div>
                  <dt className="text-xs text-muted-foreground">Currently linked item</dt>
                  <dd className="break-all">{state.existingItem}</dd>
                </div>
              )}
              {state.newItem && (
                <div>
                  <dt className="text-xs text-muted-foreground">Item you tried to link</dt>
                  <dd className="break-all">{state.newItem}</dd>
                </div>
              )}
            </dl>
          </>
        )}
        {state?.kind === "requiredRelation" && (
          <>
            <DialogHeader>
              <DialogTitle>Required relation</DialogTitle>
              <DialogDescription>
                This item can&rsquo;t be removed because a required relation elsewhere still points
                to it. Delete or re-link the referencing item first.
              </DialogDescription>
            </DialogHeader>
            <p className="break-all text-sm text-muted-foreground">{state.affectedRelation}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
