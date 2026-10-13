import { type ReactNode, useState } from "react";
import { ErrorPage } from "@contentgrid/features/app-info-pages";
import { EntityItemContentFocusView } from "@contentgrid/features/entity-item";
import { BreadCrumbsToolBarLayout } from "@contentgrid/features/layout";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { useViewTarget } from "@contentgrid/navigator-data";
import { ViewTargetGate } from "../gate/view-target-gate";
import { useNavigation } from "../navigation";
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
          withBreadcrumbsChrome(profileEntity, itemIdOf(target), hideToolbar, state)
        }
      >
        {({ profileEntity, entityItem }) =>
          entityItem ? (
            <EntityItemContentFocusView
              entityName={profileEntity.name}
              itemId={entityItem.id}
              toolbar={
                hideToolbar
                  ? false
                  : {
                      breadcrumbs: (
                        <ItemDetailBreadcrumbs
                          entityName={profileEntity.name}
                          pluralName={profileEntity.pluralName}
                          itemId={entityItem.id}
                        />
                      ),
                    }
              }
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
          ) : (
            // A collection target: this view shows one item. The profile is already known here,
            // so this keeps the same breadcrumb/toolbar chrome as the loading and error states
            // instead of filling the whole view.
            withBreadcrumbsChrome(
              profileEntity,
              itemIdOf(target),
              hideToolbar,
              <ErrorPage
                model={{
                  kind: "unknown",
                  title: "Not an item",
                  detail: "This view shows one item; the target addresses a collection.",
                }}
              />,
            )
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

/** The view's own toolbar (breadcrumbs), shared by every state that isn't the found item itself
 * (which draws its breadcrumbs through `EntityItemContentFocusView`'s own toolbar prop instead). */
function withBreadcrumbsChrome(
  profileEntity: ProfileEntity,
  itemId: string,
  hideToolbar: boolean,
  content: ReactNode,
): ReactNode {
  if (hideToolbar) return content;
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={
        <ItemDetailBreadcrumbs
          entityName={profileEntity.name}
          pluralName={profileEntity.pluralName}
          itemId={itemId}
        />
      }
    >
      {content}
    </BreadCrumbsToolBarLayout>
  );
}

// Only used while loading, before the item's own id is known: a name target carries it, a link
// target does not (the id is never read out of a link).
function itemIdOf(target: ViewProps["target"]): string {
  return target.kind === "name" ? (target.itemId ?? "") : "…";
}
