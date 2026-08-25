import { useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityItemView,
  ensureEntityItemDetailLoaderData,
} from "@contentgrid/features/entity-item";
import { type ProfileEntity, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@contentgrid/ui";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: ({ context, params }) => ensureEntityItemDetailLoaderData(context, params.itemId),
  component: EntityItemDetailPage,
});

function EntityItemDetailPage() {
  const { entity: entityName, itemId } = useParams({ strict: false });

  // EntityProfileGate (the parent /$entity route) already resolved and
  // validated the profile before this renders — this is a cached read.
  const { data: profile } = useProfileEntity({ name: entityName });

  if (!profile || !itemId) return <LoadingPage />;

  return <EntityItemDetailRoute profile={profile} itemId={itemId} />;
}

// ---------------------------------------------------------------------------
// Relation-problem dialog — the app's default handling for the relation
// mutation problems `EntityItemView` surfaces (`missing-relation-target`,
// `blind-relation-overwrite`, `required-relation`): show what the problem
// body actually said, since there's no dedicated resolution flow yet. A
// track that wants richer behavior (e.g. jumping straight to the linked item)
// can pass its own `on*Click` handlers to `EntityItemView` instead.
// ---------------------------------------------------------------------------

type RelationProblemDialogState =
  | { readonly kind: "missingRelationTarget"; readonly url: string; readonly field?: string }
  | {
      readonly kind: "blindRelationOverwrite";
      readonly existingItem?: string;
      readonly existingRelation?: string;
      readonly newItem?: string;
      readonly newRelation?: string;
    }
  | { readonly kind: "requiredRelation"; readonly affectedRelation: string };

function RelationProblemDialog({
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

function EntityItemDetailRoute({
  profile,
  itemId,
}: Readonly<{ profile: ProfileEntity; itemId: string }>) {
  const go = useNavigate();
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <button
            type="button"
            onClick={() => go({ to: "/", search: {} })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <button
            type="button"
            onClick={() =>
              // Empty search, not `(prev) => prev`: filters aren't carried in this page's URL
              // (see the list route's `onEntityItemClick`) — the list restores its earlier
              // filters and page position from the QueryClient-remembered memos instead.
              go({ to: "/$entity", params: { entity: profile.name }, search: {} })
            }
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {profile.pluralName}
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{itemId}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <>
      <EntityItemView
        profile={profile}
        itemId={itemId}
        toolbar
        breadcrumbs={breadcrumbs}
        onRelationItemClick={(profileEntityName, relatedItemId) =>
          go({
            to: "/$entity/$itemId",
            params: { entity: profileEntityName, itemId: relatedItemId },
            search: (prev) => prev,
          })
        }
        onMissingRelationTargetClick={(url, field) =>
          setProblemDialog({ kind: "missingRelationTarget", url, field })
        }
        onBlindRelationOverwriteClick={(info) =>
          setProblemDialog({ kind: "blindRelationOverwrite", ...info })
        }
        onRequiredRelationClick={(affectedRelation) =>
          setProblemDialog({ kind: "requiredRelation", affectedRelation })
        }
      />
      <RelationProblemDialog
        state={problemDialog}
        onOpenChange={(open) => !open && setProblemDialog(null)}
      />
    </>
  );
}
