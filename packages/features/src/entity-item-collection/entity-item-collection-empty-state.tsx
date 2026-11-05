import { PlusIcon } from "@phosphor-icons/react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import { EntityIconBadge } from "../layout";

export interface EntityItemCollectionEmptyStateProps {
  readonly profile: ProfileEntity;
  /** Opens the create form. Offered only when the profile has a create form. */
  readonly onCreateItem?: () => void;
}

/** Shown in place of the table when an unfiltered collection has no items the user can see. */
export function EntityItemCollectionEmptyState({
  profile,
  onCreateItem,
}: Readonly<EntityItemCollectionEmptyStateProps>) {
  const canCreate = profile.createTemplate !== null && onCreateItem !== undefined;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="mb-2">
        <EntityIconBadge profile={profile} variant="lg" muted />
      </div>
      <h2 className="text-lg font-semibold">No {profile.pluralName} found</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {profile.pluralName} you can access will appear here.
      </p>
      {canCreate && (
        <Button variant="outline" className="mt-3" onClick={onCreateItem}>
          <PlusIcon aria-hidden />
          Create {profile.title}
        </Button>
      )}
    </div>
  );
}
