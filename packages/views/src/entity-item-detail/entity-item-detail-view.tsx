import { useState } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemContentFocusView } from "@contentgrid/features/entity-item";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItem,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { useNavigation } from "../navigation";
import { ViewPage } from "../toolbar/view-page";
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
 * breadcrumb toolbar drawn by this view (`ViewPage`). Fetches the profile (`useProfileEntity`) and
 * then the item (`useEntityItem`) itself, drawing its own loading/error state for each — the
 * breadcrumb toolbar is already known and stays up once the profile resolves, even while the item
 * is still loading or fails. `EntityItemContentFocusView` fills the space it is given with an
 * already-loaded `profileEntity`/`entityItem`; it fetches nothing and draws no chrome. Every click
 * that opens something calls `useNavigation()`.
 */
export function EntityItemDetailView({
  entityName,
  itemId,
  toolbar = true,
}: Readonly<EntityItemDetailViewProps>) {
  const profile = useProfileEntity({ name: entityName });

  if (!profile.data) {
    // Defensive: the app's `/$entity` route gate already guarantees a valid, loaded profile
    // before this view mounts — unreachable in practice, but this view can also be mounted
    // standalone.
    return profile.isPending ? (
      <LoadingPage />
    ) : (
      <ErrorPage
        model={toProblemDisplayModel(profile.error ?? `No profile for entity "${entityName}"`)}
      />
    );
  }

  return (
    <LoadedEntityItemDetailView profileEntity={profile.data} itemId={itemId} toolbar={toolbar} />
  );
}

function LoadedEntityItemDetailView({
  profileEntity,
  itemId,
  toolbar,
}: Readonly<{ profileEntity: ProfileEntity; itemId: string; toolbar: boolean }>) {
  const navigation = useNavigation();
  const [problemDialog, setProblemDialog] = useState<RelationProblemDialogState | null>(null);
  const item = useEntityItem({ profileEntity, entityId: itemId });

  const breadcrumbs = (
    <ItemDetailBreadcrumbs
      entityName={profileEntity.name}
      pluralName={profileEntity.pluralName}
      itemId={itemId}
    />
  );

  if (!item.data) {
    const state = item.isPending ? (
      <LoadingPage />
    ) : (
      <ErrorPage model={toProblemDisplayModel(item.error ?? `Item "${itemId}" not found`)} />
    );
    return (
      <ViewPage breadcrumbs={breadcrumbs} hideToolbar={!toolbar}>
        {state}
      </ViewPage>
    );
  }

  return (
    <ViewPage
      breadcrumbs={breadcrumbs}
      hideToolbar={!toolbar}
      // A content preview runs edge to edge under the toolbar; the plain body keeps the page
      // gutters.
      contentPadded={profileEntity.hasContentAttributes ? "bottom" : true}
    >
      <EntityItemContentFocusView
        profileEntity={profileEntity}
        entityItem={item.data}
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
    </ViewPage>
  );
}
