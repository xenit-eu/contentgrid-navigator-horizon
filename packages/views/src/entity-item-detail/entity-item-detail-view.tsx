import { type ReactNode, useRef, useState } from "react";
import { PencilSimpleIcon } from "@phosphor-icons/react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityItemAutoVariation,
  type EntityItemEditHandle,
  isEditableEntityItem,
  useEntityItemDetailPadding,
} from "@contentgrid/features/entity-item";
import { DeleteEntityItemButton } from "@contentgrid/features/entity-item-delete";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { EntityItemDetailBreadcrumbs } from "../breadcrumbs";
import { type EntityItemTarget, useEntityItemTarget } from "../hooks/use-entity-item-target";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";
import type { ViewProps } from "../types/view";
import { RelationProblemDialog, type RelationProblemDialogState } from "./relation-problem-dialog";

/**
 * The toolbar's Edit and Delete as the design draws them (`.b`): 36px high, 8px radius, 14px side
 * padding, 8px between icon and label, 13.5px semibold, no shadow, strong (`--input`) border.
 * Local to these two buttons: the shared Button variants differ.
 */
const TOOLBAR_BUTTON_CLASS =
  "h-9 gap-2 rounded-sm px-3.5 has-[>svg]:px-3.5 text-[13.5px] font-semibold shadow-none";

/** Delete is the same outline button as Edit with its text and icon in the destructive colour. */
const DELETE_BUTTON_CLASS = `${TOOLBAR_BUTTON_CLASS} border-input`;

/** Opened by entity name and item id, or by the item's own link. */
export type EntityItemDetailViewProps = ViewProps & EntityItemTarget & { allowEdit?: boolean };

function describeTarget(target: EntityItemTarget): string {
  return "itemUrl" in target
    ? `No profile describes "${target.itemUrl}"`
    : `No profile for entity "${target.entityName}"`;
}

/**
 * One entity item: its content or attributes and relations, under a Home, collection, item
 * breadcrumb toolbar. Resolves the target itself (`useEntityItemTarget`); the toolbar is drawn
 * from that result in every state, each crumb appearing as soon as it is known, and the loading,
 * error and not-found states show inside it. The feature only gets the loaded `entityItem`. The
 * relation-problem dialog lives here (not in the feature): `onMissingRelationTargetClick`/
 * `onBlindRelationOverwriteClick`/`onRequiredRelationClick` fill `RelationProblemDialogState`.
 * Every click that opens something calls `useViewNavigation()`.
 */
export function EntityItemDetailView({
  toolbar,
  allowEdit,
  ...target
}: Readonly<EntityItemDetailViewProps>) {
  const navigation = useViewNavigation();
  const result = useEntityItemTarget(target);
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);

  // The toolbar's Edit and Cancel edit drive the feature's edit mode through this handle (the
  // feature then draws no Edit button of its own); `isEditing` follows the feature's
  // `onEditingChange`. It also hides the toolbar's Delete while the edit form is open: deleting
  // would navigate away and run into the unsaved-changes prompt.
  const editHandle = useRef<EntityItemEditHandle>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Gated on the item's update template, like the Delete below on its delete template.
  const editAction =
    result.status === "success" && toolbar !== false && isEditableEntityItem(result.entityItem) ? (
      <Button
        type="button"
        variant="outline"
        size="default"
        className={`${TOOLBAR_BUTTON_CLASS} border-input`}
        onClick={() =>
          isEditing ? editHandle.current?.cancelEdit() : editHandle.current?.startEdit()
        }
      >
        <PencilSimpleIcon />
        {isEditing ? "Cancel edit" : "Edit"}
      </Button>
    ) : null;

  // With a toolbar, Delete goes in it. Without one, the variation draws its own next to Edit
  // (`onDeleted`).
  const deleteAction =
    result.status === "success" && toolbar !== false && (allowEdit ?? true) && !isEditing ? (
      <DeleteEntityItemButton
        item={result.entityItem}
        label="Delete"
        className={DELETE_BUTTON_CLASS}
        onDeleted={() => navigation.openEntityItemCollection(result.profileEntity.name)}
        onRefresh={() => void result.refetch()}
      />
    ) : null;

  let content: ReactNode;
  if (result.status === "not-found") {
    content = <ErrorPage model={toProblemDisplayModel(describeTarget(target))} />;
  } else if (result.status === "error") {
    content = <ErrorPage model={toProblemDisplayModel(result.error)} />;
  } else if (result.status === "success") {
    content = (
      <EntityItemAutoVariation
        entityItem={result.entityItem}
        refetch={result.refetch}
        allowEdit={allowEdit}
        onRelationItemClick={({ entityName: relatedEntityName, itemId: relatedItemId }) =>
          navigation.openItem(relatedEntityName, relatedItemId)
        }
        onRelationItemCreateNew={(targetEntityName) =>
          navigation.openCreateItem(targetEntityName, { openInNewTab: true })
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
        onDeleted={
          toolbar === false
            ? () => navigation.openEntityItemCollection(result.profileEntity.name)
            : undefined
        }
        onEditingChange={setIsEditing}
        editHandleRef={toolbar === false ? undefined : editHandle}
      />
    );
  } else {
    content = <LoadingPage />;
  }

  const profileEntity = result.status === "not-found" ? undefined : result.profileEntity;
  const contentPadding = useEntityItemDetailPadding(profileEntity);

  if (toolbar === false) {
    return (
      <PageLayout padded={contentPadding}>
        {content}
        <RelationProblemDialog
          state={problemDialog}
          onOpenChange={(open) => !open && setProblemDialog(null)}
        />
      </PageLayout>
    );
  }
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={
        <EntityItemDetailBreadcrumbs
          profileEntity={profileEntity}
          entityItem={result.status === "success" ? result.entityItem : undefined}
        />
      }
      actions={
        <>
          {toolbar?.actions} {editAction} {deleteAction}
        </>
      }
      contentPadded={contentPadding}
    >
      {content}
      <RelationProblemDialog
        state={problemDialog}
        onOpenChange={(open) => !open && setProblemDialog(null)}
      />
    </BreadCrumbsToolBarLayout>
  );
}
