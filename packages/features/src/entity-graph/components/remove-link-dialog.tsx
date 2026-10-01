import { toast } from "sonner";
import {
  type EntityItem,
  type EntityItemToManyRelation,
  type EntityItemToOneRelation,
  toProblemDisplayModel,
  useClearRelation,
  useUnlinkRelation,
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

interface RemoveLinkDialogCommonProps {
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Called after the server confirmed the removal. */
  readonly onRemoved: () => void;
}

export type RemoveLinkDialogProps = RemoveLinkDialogCommonProps &
  (
    | { readonly relation: EntityItemToOneRelation; readonly target?: undefined }
    | { readonly relation: EntityItemToManyRelation; readonly target: EntityItem }
  );

interface ConfirmShellProps extends RemoveLinkDialogCommonProps {
  readonly relationTitle: string;
  readonly pending: boolean;
  readonly error: Error | null;
  readonly onConfirm: () => void;
}

function RemoveLinkConfirm({
  relationTitle,
  sourceLabel,
  targetLabel,
  open,
  onOpenChange,
  pending,
  error,
  onConfirm,
}: Readonly<ConfirmShellProps>) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove link?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the <strong>{relationTitle}</strong> link from{" "}
            <strong>{sourceLabel}</strong> to <strong>{targetLabel}</strong>. Both items are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <ProblemAlert model={toProblemDisplayModel(error)} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          {/* A plain Button, not AlertDialogAction: the dialog must stay open on failure (FR-024). */}
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Removing…" : "Remove link"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RemoveToOneLink(
  props: Readonly<RemoveLinkDialogCommonProps & { relation: EntityItemToOneRelation }>,
) {
  const { relation, onRemoved, onOpenChange } = props;
  const mutation = useClearRelation(relation, {
    mutationOptions: {
      onSuccess: () => {
        toast.success("Link removed");
        onOpenChange(false);
        onRemoved();
      },
    },
  });
  return (
    <RemoveLinkConfirm
      {...props}
      relationTitle={relation.profileRelation.title}
      pending={mutation.isPending}
      error={mutation.error}
      onConfirm={() => mutation.mutate()}
    />
  );
}

function RemoveToManyLink(
  props: Readonly<
    RemoveLinkDialogCommonProps & { relation: EntityItemToManyRelation; target: EntityItem }
  >,
) {
  const { relation, target, onRemoved, onOpenChange } = props;
  const mutation = useUnlinkRelation(relation, {
    mutationOptions: {
      onSuccess: () => {
        toast.success("Link removed");
        onOpenChange(false);
        onRemoved();
      },
    },
  });
  return (
    <RemoveLinkConfirm
      {...props}
      relationTitle={relation.profileRelation.title}
      pending={mutation.isPending}
      error={mutation.error}
      onConfirm={() => mutation.mutate(target)}
    />
  );
}

/**
 * Confirmation for the single "Remove link" action (FR-021/FR-022): clears a to-one relation, or
 * unlinks this one target from a to-many relation. Never deletes an item. Driven entirely by the
 * existing relation mutation hooks — no request is built here.
 */
export function RemoveLinkDialog(props: Readonly<RemoveLinkDialogProps>) {
  if (props.relation.profileRelation.isToMany) {
    const { relation, target, ...rest } = props as Extract<
      RemoveLinkDialogProps,
      { target: EntityItem }
    >;
    return <RemoveToManyLink {...rest} relation={relation} target={target} />;
  }
  const { relation, ...rest } = props as Extract<RemoveLinkDialogProps, { target?: undefined }>;
  return <RemoveToOneLink {...rest} relation={relation} />;
}
