import { useState } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemContentFocusView } from "@contentgrid/features/entity-item";
import { toProblemDisplayModel, useProfileEntity } from "@contentgrid/navigator-data";
import { useNavigation } from "../navigation";
import { ItemDetailBreadcrumbs } from "./item-detail-breadcrumbs";
import { RelationProblemDialog, type RelationProblemDialogState } from "./relation-problem-dialog";

export interface EntityItemDetailViewProps {
  /** Profile entity name — never the plural path. */
  readonly entityName: string;
  /** The item's `id` field. */
  readonly itemId: string;
  /** Turns off the view's own toolbar (breadcrumbs); the host then draws its own. Defaults to `true`. */
  readonly toolbar?: boolean;
}

/**
 * One entity item: its content or attributes and relations, under a Home, collection, item
 * breadcrumb toolbar. Fetches the profile directly (`useProfileEntity`) for the breadcrumb labels;
 * the item itself is fetched by `EntityItemContentFocusView`, which also draws the loading/error
 * state for it, wrapped in this toolbar. Every click that opens something calls `useNavigation()`.
 */
export function EntityItemDetailView({
  entityName,
  itemId,
  toolbar = true,
}: Readonly<EntityItemDetailViewProps>) {
  const navigation = useNavigation();
  const profile = useProfileEntity({ name: entityName });
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);

  if (!profile.data) {
    // Defensive: the app's `/$entity` route gate already guarantees a valid, loaded profile
    // before this view mounts (same assumption `EntityItemContentFocusView` makes for its own
    // profile fetch) — unreachable in practice, but this view can also be mounted standalone.
    return profile.isPending ? (
      <LoadingPage />
    ) : (
      <ErrorPage
        model={toProblemDisplayModel(profile.error ?? `No profile for entity "${entityName}"`)}
      />
    );
  }

  return (
    <>
      <EntityItemContentFocusView
        entityName={entityName}
        itemId={itemId}
        toolbar={
          toolbar
            ? {
                breadcrumbs: (
                  <ItemDetailBreadcrumbs
                    entityName={entityName}
                    pluralName={profile.data.pluralName}
                    itemId={itemId}
                  />
                ),
              }
            : false
        }
        onRelationItemClick={({ entityName: relatedEntityName, itemId: relatedItemId }) =>
          navigation.openItem(relatedEntityName, relatedItemId)
        }
        onRelationItemCreateNew={navigation.openCreateItem}
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
