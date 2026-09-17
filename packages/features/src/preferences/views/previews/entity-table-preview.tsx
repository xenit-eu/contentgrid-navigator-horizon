import { CircleNotchIcon as CircleNotch } from "@phosphor-icons/react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useEntityItemCollection,
} from "@contentgrid/navigator-data";
import { Alert, AlertDescription, Label } from "@contentgrid/ui";
import { EntityItemCollectionTable } from "../../../entity-item-collection";
import { ProblemAlert } from "../../../problem-details";

export interface EntityTablePreviewProps {
  readonly profile: ProfileEntity;
}

/**
 * Live preview of how `profile`'s items render as a table, embedded in the entity
 * configuration detail page. Height-capped and scrollable — this is a preview, not the
 * full collection view.
 */
export function EntityTablePreview({ profile }: Readonly<EntityTablePreviewProps>) {
  const collection = useEntityItemCollection({ profileEntity: profile });

  return (
    <div className="space-y-1.5">
      <Label>Table preview</Label>
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
        <div className="max-h-128 overflow-y-auto">
          <EntityItemCollectionTable profile={profile} collection={collection.data} />
        </div>
      )}
    </div>
  );
}
