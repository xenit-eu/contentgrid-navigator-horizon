import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { Alert, AlertDescription } from "@contentgrid/ui";
import { EntityItemAttributes, EntityItemReference } from "../../../entity-item";
import { ProblemAlert } from "../../../problem-details";

export interface EntityItemPreviewProps {
  readonly profile: ProfileEntity;
}

/**
 * Live preview of how a single `profile` item renders — its reference and
 * attributes — embedded in the entity configuration detail page. Shows the
 * first item from the collection.
 */
export function EntityItemPreview({ profile }: Readonly<EntityItemPreviewProps>) {
  const collection = useEntityItemCollection({ profileEntity: profile });

  return (
    <div className="space-y-3">
      {collection.isPending && (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <CircleNotch className="size-4 animate-spin" aria-hidden />
          Loading preview…
        </div>
      )}
      {collection.isError && <ProblemAlert model={toProblemDisplayModel(collection.error)} />}
      {collection.isSuccess && collection.data.isEmpty && (
        <Alert>
          <AlertDescription>
            Please create a {profile.singularName} item to enable the preview
          </AlertDescription>
        </Alert>
      )}
      {collection.isSuccess && !collection.data.isEmpty && (
        <div className="space-y-3">
          <EntityItemReference item={collection.data.items[0]} size="lg" />
          <EntityItemReference item={collection.data.items[0]} size="default" />
          <EntityItemReference item={collection.data.items[0]} size="sm" />
          <EntityItemAttributes profile={profile} item={collection.data.items[0]} />
        </div>
      )}
    </div>
  );
}
