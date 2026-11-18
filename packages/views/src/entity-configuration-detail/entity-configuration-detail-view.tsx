import type { ReactNode } from "react";
import { XIcon as X } from "@phosphor-icons/react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityProfileSelector } from "@contentgrid/features/layout";
import { EntityColorBadge } from "@contentgrid/features/preferences";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useLoadedProfileEntities,
} from "@contentgrid/navigator-data";
import { Button, Card, CardAction, CardContent, CardHeader, PageTitle } from "@contentgrid/ui";
import { EntityConfigurationBreadcrumbs } from "../breadcrumbs";
import { useProfileEntityTarget } from "../hooks/use-profile-entity-target";
import { BreadCrumbsToolBarLayout, PageLayout } from "../layout";
import { useViewNavigation } from "../navigation";
import type { ViewProps } from "../types/view";
import { EntityConfigurationPanel } from "./entity-configuration-panel";

export type EntityConfigurationDetailViewProps = ViewProps & {
  /** Profile entity name — never the plural path. */
  readonly entityName: string;
};

/**
 * One entity's display configuration (`~configuration/$entity`): a card with the entity's title,
 * a color badge and a close button, holding the preview tabs and the settings
 * (`EntityConfigurationPanel`), under a Settings › entity breadcrumb toolbar with an entity
 * selector on the right. Resolves the profile itself and draws the loading and not-found states
 * inside the toolbar. Close and the Settings crumb go back to the settings page, and the selector
 * opens another entity's configuration, through `useViewNavigation()`.
 */
export function EntityConfigurationDetailView({
  toolbar,
  entityName,
}: Readonly<EntityConfigurationDetailViewProps>) {
  const navigation = useViewNavigation();
  const result = useProfileEntityTarget({ entityName });
  const { profiles } = useLoadedProfileEntities();

  let content: ReactNode;
  if (result.status === "not-found") {
    content = <ErrorPage model={toProblemDisplayModel(`No profile for entity "${entityName}"`)} />;
  } else if (result.status === "pending") {
    content = <LoadingPage />;
  } else {
    content = (
      <EntityConfigurationCard
        profile={result.profileEntity}
        onClose={() => navigation.openSettings()}
      />
    );
  }

  if (toolbar === false) {
    return <PageLayout>{content}</PageLayout>;
  }

  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={
        <EntityConfigurationBreadcrumbs
          profileEntity={result.status === "success" ? result.profileEntity : undefined}
        />
      }
      actions={
        <>
          {result.status === "success" && (
            <EntityProfileSelector
              profiles={profiles}
              selectedProfile={result.profileEntity}
              onSelect={(profile) => navigation.openEntityConfiguration(profile.name)}
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

function EntityConfigurationCard({
  profile,
  onClose,
}: Readonly<{ profile: ProfileEntity; onClose: () => void }>) {
  return (
    // Fills the page: the panel below takes the height left under the header.
    <Card className="h-full">
      <CardHeader>
        <PageTitle
          header="Configure display"
          title={profile.pluralName}
          subtitle={`Change configuration settings for this entity. Changes in this page will reflect how ${profile.pluralName} are rendered.`}
          icon={<EntityColorBadge profile={profile} />}
        />
        <CardAction>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden />
            <span className="sr-only">Close</span>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <EntityConfigurationPanel profile={profile} />
      </CardContent>
    </Card>
  );
}
