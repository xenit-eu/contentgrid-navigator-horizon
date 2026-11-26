import type { ReactNode } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  CreateEntityItemPanel,
  CreateEntityItemProfileSelector,
} from "@contentgrid/features/entity-item-create";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";
import { EntityItemCreateBreadcrumbs } from "../breadcrumbs";
import { useProfileEntityTarget } from "../hooks/use-profile-entity-target";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";
import type { ViewProps } from "../types/view";

export type EntityItemCreateViewProps = ViewProps & {
  readonly entityName: string;
};

/** One entity's create form, with a breadcrumb toolbar containing an entity selector. */
export function EntityItemCreateView({ entityName, toolbar }: Readonly<EntityItemCreateViewProps>) {
  const navigation = useViewNavigation();
  const result = useProfileEntityTarget({ entityName });

  let content: ReactNode;
  if (result.status === "not-found") {
    // Normally (e.g. on /missing/~create) you'd get the error from EntityProfileGate first
    content = <ErrorPage model={toProblemDisplayModel(`No profile for entity "${entityName}"`)} />;
  } else if (result.status === "pending") {
    content = <LoadingPage />;
  } else {
    const { profileEntity } = result;
    content = (
      // Keyed on the entity: switching entity keeps this view mounted, the form must not.
      <CreateEntityItemPanel
        key={profileEntity.name}
        profile={profileEntity}
        onCreated={(item) => navigation.openItem(profileEntity.name, item.id)}
        onCancel={() => navigation.openEntityItemCollection(profileEntity.name)}
        onRelationItemClick={(name, id) => navigation.openItem(name, id, { openInNewTab: true })}
        onRelationItemCreateNew={(name) => navigation.openCreateItem(name, { openInNewTab: true })}
      />
    );
  }

  if (toolbar === false) {
    return <PageLayout>{content}</PageLayout>;
  }

  const profileEntity = result.status === "success" ? result.profileEntity : undefined;
  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={<EntityItemCreateBreadcrumbs profileEntity={profileEntity} />}
      actions={
        <>
          {profileEntity && (
            <CreateEntityItemProfileSelector
              selectedProfile={profileEntity}
              onSelect={(next) => navigation.openCreateItem(next.name)}
            />
          )}
          {toolbar?.actions}
        </>
      }
    >
      {content}
    </BreadCrumbsToolBarLayout>
  );
}
