import { useState } from "react";
import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityItemContentFocusView,
  ensureEntityItemDetailLoaderData,
} from "@contentgrid/features/entity-item";
import { BreadcrumbLink } from "@contentgrid/ui";
import {
  RelationProblemDialog,
  type RelationProblemDialogState,
} from "../../../components/relation-problem-dialog";

export const Route = createFileRoute("/_app/$entity/$itemId")({
  loader: ({ context, params }) => ensureEntityItemDetailLoaderData(context, params.itemId),
  component: EntityItemDetailPage,
});

function EntityItemDetailPage() {
  const { entity: entityName, itemId } = useParams({ strict: false });

  // The route params are always defined once this component actually renders (matched by the
  // file-based route below) — `strict: false` just widens the inferred type across every route.
  if (!entityName || !itemId) return <LoadingPage />;

  return <EntityItemDetailRoute entityName={entityName} itemId={itemId} />;
}

function EntityItemDetailRoute({
  entityName,
  itemId,
}: Readonly<{ entityName: string; itemId: string }>) {
  const go = useNavigate();
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);

  return (
    <>
      <EntityItemContentFocusView
        entityName={entityName}
        itemId={itemId}
        renderHomeLink={(label) => (
          <BreadcrumbLink asChild>
            <Link to="/" search={{}}>
              {label}
            </Link>
          </BreadcrumbLink>
        )}
        renderCollectionLink={(relatedEntityName, label) => (
          <BreadcrumbLink asChild>
            {/* Empty search, not `(prev) => prev`: filters aren't carried in this page's URL (see
                the list route's `onEntityItemClick`) — the list restores its earlier filters and
                page position from the QueryClient-remembered page href instead. */}
            <Link to="/$entity" params={{ entity: relatedEntityName }} search={{}}>
              {label}
            </Link>
          </BreadcrumbLink>
        )}
        onOpenGraph={() =>
          go({ to: "/$entity/$itemId/~graph", params: { entity: entityName, itemId }, search: {} })
        }
        onRelationItemClick={({ entityName: relatedEntityName, itemId: relatedItemId }) =>
          go({
            to: "/$entity/$itemId",
            params: { entity: relatedEntityName, itemId: relatedItemId },
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
