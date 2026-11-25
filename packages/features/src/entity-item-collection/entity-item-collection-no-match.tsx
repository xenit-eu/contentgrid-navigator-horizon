import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import type { ProfileEntity } from "@contentgrid/navigator-data";
import { Button } from "@contentgrid/ui";
import {
  EMPTY_BLOCK_BUTTON_CLASS,
  EntityItemCollectionEmptyBlock,
} from "./entity-item-collection-empty-block";

export interface EntityItemCollectionNoMatchProps {
  readonly profile: ProfileEntity;
  /** Drops every filter. */
  readonly onClearFilters: () => void;
}

/** Shown in place of the table when the active filters match no item; search and filters stay. */
export function EntityItemCollectionNoMatch({
  profile,
  onClearFilters,
}: Readonly<EntityItemCollectionNoMatchProps>) {
  return (
    <EntityItemCollectionEmptyBlock
      icon={<MagnifyingGlassIcon weight="bold" />}
      title={`No ${profile.pluralName.toLowerCase()} match these filters`}
      description="Remove a filter or clear them all."
    >
      <Button
        variant="outline"
        className={`${EMPTY_BLOCK_BUTTON_CLASS} text-foreground shadow-none`}
        onClick={onClearFilters}
      >
        Clear all filters
      </Button>
    </EntityItemCollectionEmptyBlock>
  );
}
