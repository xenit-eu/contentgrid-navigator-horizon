import { useState } from "react";
import { ErrorPage } from "@contentgrid/features/app-info-pages";
import { EntityItemContentFocusView } from "@contentgrid/features/entity-item";
import { useViewTarget } from "@contentgrid/navigator-data";
import { ViewTargetGate } from "../gate/view-target-gate";
import { useNavigation } from "../navigation";
import { ViewPage } from "../toolbar/view-page";
import type { ViewProps } from "../types";
import { ItemDetailBreadcrumbs } from "./item-detail-breadcrumbs";
import { RelationProblemDialog, type RelationProblemDialogState } from "./relation-problem-dialog";

export interface EntityItemDetailViewProps extends ViewProps {
  /** Turns off the view's own toolbar (breadcrumbs); the host then draws its own. */
  readonly hideToolbar?: boolean;
  /**
   * Fired when the user asks to create a missing relation target. The view never opens pages
   * itself; the host decides (today: a new browser tab).
   */
  readonly onRelationItemCreateNew?: (entityName: string) => void;
}

/**
 * One entity item: its content or attributes and relations, under a Home, collection, item
 * breadcrumb toolbar. Takes a `ViewTarget` (a name with an item id, or a link to an item) and
 * resolves it through `useViewTarget`; every click that opens something calls `useNavigation()`.
 */
export function EntityItemDetailView({
  target,
  hideToolbar = false,
  onRelationItemCreateNew,
}: Readonly<EntityItemDetailViewProps>) {
  const navigation = useNavigation();
  const result = useViewTarget(target);
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);

  return (
    <>
      <ViewTargetGate
        result={result}
        renderChrome={(profileEntity, state) =>
          hideToolbar ? (
            state
          ) : (
            <ViewPage
              breadcrumbs={
                <ItemDetailBreadcrumbs
                  entityName={profileEntity.name}
                  pluralName={profileEntity.pluralName}
                  itemId={itemIdOf(target)}
                />
              }
            >
              {state}
            </ViewPage>
          )
        }
      >
        {({ profileEntity, entityItem }) =>
          entityItem ? (
            <ViewPage
              breadcrumbs={
                <ItemDetailBreadcrumbs
                  entityName={profileEntity.name}
                  pluralName={profileEntity.pluralName}
                  itemId={entityItem.id}
                />
              }
              hideToolbar={hideToolbar}
              // A content preview runs edge to edge under the toolbar; the plain body keeps the
              // page gutters.
              contentPadded={profileEntity.hasContentAttributes ? "bottom" : true}
            >
              <EntityItemContentFocusView
                profileEntity={profileEntity}
                entityItem={entityItem}
                onRelationItemClick={({ entityName, itemId }) =>
                  navigation.openItem(entityName, itemId)
                }
                onRelationItemCreateNew={onRelationItemCreateNew}
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
            </ViewPage>
          ) : (
            // A collection target: this view shows one item.
            <ErrorPage
              model={{
                kind: "unknown",
                title: "Not an item",
                detail: "This view shows one item; the target addresses a collection.",
              }}
            />
          )
        }
      </ViewTargetGate>
      <RelationProblemDialog
        state={problemDialog}
        onOpenChange={(open) => !open && setProblemDialog(null)}
      />
    </>
  );
}

// Only used while loading, before the item's own id is known: a name target carries it, a link
// target does not (the id is never read out of a link).
function itemIdOf(target: ViewProps["target"]): string {
  return target.kind === "name" ? (target.itemId ?? "") : "…";
}
