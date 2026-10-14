import type { ReactNode } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  EntityItemContentFocusBody,
  entityItemContentFocusPadding,
} from "@contentgrid/features/entity-item";
import { BreadCrumbsToolBarLayout, PageLayout } from "@contentgrid/features/layout";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";
import { EntityBreadcrumbs } from "../breadcrumbs";
import { type EntityItemTarget, useEntityItemTarget } from "../hooks/use-entity-item-target";
import { useNavigation } from "../navigation";
import type { ViewProps } from "../types/view";

/** Opened by entity name and item id, or by the item's own link. */
export type EntityItemDetailViewProps = ViewProps & EntityItemTarget;

function describeTarget(target: EntityItemTarget): string {
  return "itemUrl" in target
    ? `No profile describes "${target.itemUrl}"`
    : `No profile for entity "${target.entityName}"`;
}

/**
 * One entity item: its content or attributes and relations, under a Home, collection, item
 * breadcrumb toolbar. Resolves the target itself (`useEntityItemTarget`); the toolbar is drawn
 * from that result in every state, each crumb appearing as soon as it is known, and the loading,
 * error and not-found states show inside it. The feature only gets the loaded `entityItem`.
 * Every click that opens something calls `useNavigation()`.
 */
export function EntityItemDetailView({ toolbar, ...target }: Readonly<EntityItemDetailViewProps>) {
  const navigation = useNavigation();
  const result = useEntityItemTarget(target);

  let content: ReactNode;
  if (result.status === "not-found") {
    content = <ErrorPage model={toProblemDisplayModel(describeTarget(target))} />;
  } else if (result.status === "error") {
    content = <ErrorPage model={toProblemDisplayModel(result.error)} />;
  } else if (result.status === "success") {
    content = (
      <EntityItemContentFocusBody
        entityItem={result.entityItem}
        onRelationItemClick={({ entityName: relatedEntityName, itemId: relatedItemId }) =>
          navigation.openItem(relatedEntityName, relatedItemId)
        }
        onRelationItemCreateNew={navigation.openCreateItem}
      />
    );
  } else {
    content = <LoadingPage />;
  }

  const profileEntity = result.status === "not-found" ? undefined : result.profileEntity;
  const contentPadding = profileEntity ? entityItemContentFocusPadding(profileEntity) : true;

  if (toolbar === false) {
    return <PageLayout padded={contentPadding}>{content}</PageLayout>;
  }
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={
        <EntityBreadcrumbs
          page="item"
          profileEntity={profileEntity}
          entityItem={result.status === "success" ? result.entityItem : undefined}
        />
      }
      actions={toolbar?.actions}
      contentPadded={contentPadding}
    >
      {content}
    </BreadCrumbsToolBarLayout>
  );
}
