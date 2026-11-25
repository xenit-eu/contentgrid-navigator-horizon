import { PlusIcon, TrayIcon } from "@phosphor-icons/react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import {
  EMPTY_BLOCK_BUTTON_CLASS,
  EntityItemCollectionEmptyBlock,
} from "./entity-item-collection-empty-block";

export interface EntityItemCollectionEmptyStateProps {
  readonly profile: ProfileEntity;
  /** Opens the create form. Offered only when the profile has a create form. */
  readonly onCreateItemClick?: () => void;
}

/**
 * Shown in place of the table when an unfiltered collection has no items the user can see. An
 * empty collection and one whose items are all hidden from this user can't be told apart.
 */
export function EntityItemCollectionEmptyState({
  profile,
  onCreateItemClick,
}: Readonly<EntityItemCollectionEmptyStateProps>) {
  const canCreate = profile.createTemplate !== null && onCreateItemClick !== undefined;
  const plural = profile.pluralName.toLowerCase();
  const singular = profile.singularName.toLowerCase();

  return (
    <EntityItemCollectionEmptyBlock
      icon={<TrayIcon weight="bold" />}
      title={canCreate ? `No ${plural} yet` : `No ${plural}`}
      description={
        canCreate
          ? `Create the first ${singular}. It will appear here.`
          : "There is nothing here that you have access to."
      }
    >
      {canCreate && (
        <Button
          className={`${EMPTY_BLOCK_BUTTON_CLASS} border border-primary`}
          onClick={onCreateItemClick}
        >
          <PlusIcon aria-hidden />
          New {singular}
        </Button>
      )}
    </EntityItemCollectionEmptyBlock>
  );
}
