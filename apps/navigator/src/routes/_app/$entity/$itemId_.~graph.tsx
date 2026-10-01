import { useState } from "react";
import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityGraphView,
  graphSearchValidator,
  searchToTrail,
  trailToSearch,
} from "@contentgrid/features/entity-graph";
import { ensureEntityItemDetailLoaderData } from "@contentgrid/features/entity-item";
import { BreadcrumbLink } from "@contentgrid/ui";
import {
  RelationProblemDialog,
  type RelationProblemDialogState,
} from "../../../components/relation-problem-dialog";

/**
 * Knowledge graph of one item (spec 007): `/$entity/$itemId/~graph?trail=[…]`. Not nested under
 * the item detail route (`$itemId_`), but still under the `/$entity` profile gate. The `trail`
 * search param holds the explored path after the root as plain identifiers — never URLs.
 */
export const Route = createFileRoute("/_app/$entity/$itemId_/~graph")({
  validateSearch: graphSearchValidator,
  loader: ({ context, params }) => ensureEntityItemDetailLoaderData(context, params.itemId),
  pendingComponent: () => <LoadingPage />,
  component: EntityGraphPage,
});

function EntityGraphPage() {
  const { entity: entityName, itemId } = useParams({ strict: false });
  if (!entityName || !itemId) return <LoadingPage />;
  return <EntityGraphRoute entityName={entityName} itemId={itemId} />;
}

function EntityGraphRoute({
  entityName,
  itemId,
}: Readonly<{ entityName: string; itemId: string }>) {
  const go = useNavigate();
  const search = Route.useSearch();
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);

  return (
    <>
      <EntityGraphView
        entityName={entityName}
        itemId={itemId}
        trail={searchToTrail(search.trail)}
        onTrailChange={(trail) =>
          go({
            to: "/$entity/$itemId/~graph",
            params: { entity: entityName, itemId },
            search: { trail: trailToSearch(trail) },
          })
        }
        onOpenItem={({ entityName: targetEntity, itemId: targetId }) =>
          go({
            to: "/$entity/$itemId",
            params: { entity: targetEntity, itemId: targetId },
            search: {},
          })
        }
        onOpenCollection={(targetEntity) =>
          go({ to: "/$entity", params: { entity: targetEntity }, search: {} })
        }
        renderHomeLink={(label) => (
          <BreadcrumbLink asChild>
            <Link to="/" search={{}}>
              {label}
            </Link>
          </BreadcrumbLink>
        )}
        renderCollectionLink={(collectionEntity, label) => (
          <BreadcrumbLink asChild>
            <Link to="/$entity" params={{ entity: collectionEntity }} search={{}}>
              {label}
            </Link>
          </BreadcrumbLink>
        )}
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
