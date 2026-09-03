import { type ReactNode, useState } from "react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { PageTitle, UnsavedChangesDialog } from "@contentgrid/ui";
import { useUnsavedChangesGuard } from "../unsaved-changes-guard";
import { CreateEntityItemForm } from "./create-entity-item-form";

export interface CreateEntityItemViewProps {
  readonly profile: ProfileEntity;
  /** Fired after the item is created, once any unsaved-changes block has been lifted. */
  readonly onCreated?: (item: EntityItem) => void;
  /** Renders a cancel button next to submit when provided. */
  readonly onCancel?: () => void;
  readonly renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
}

/**
 * App-agnostic create-item content: title, unsaved-changes guard, and
 * `CreateEntityItemForm`. No page chrome of its own — the caller wraps this
 * in whatever layout (e.g. `BreadCrumbsToolBarLayout`) the route needs, and
 * that layout owns the surrounding padding. All routing / navigation is
 * supplied by the caller through `onCreated` and `onCancel` — this component
 * performs no navigation itself.
 */
export function CreateEntityItemView({
  profile,
  onCreated,
  onCancel,
  renderCreateRelationTarget,
}: Readonly<CreateEntityItemViewProps>) {
  const [isDirty, setIsDirty] = useState(false);
  const unsavedChangesGuard = useUnsavedChangesGuard(isDirty);

  return (
    <div className="space-y-6">
      <PageTitle header="Create" title={profile.singularName} subtitle="" />
      <UnsavedChangesDialog
        open={unsavedChangesGuard.isBlocked}
        onConfirm={unsavedChangesGuard.confirmNavigation}
        onCancel={unsavedChangesGuard.cancelNavigation}
      />
      <CreateEntityItemForm
        profile={profile}
        onDirtyChange={setIsDirty}
        onCreated={
          onCreated && ((item) => unsavedChangesGuard.withoutBlocking(() => onCreated(item)))
        }
        onCancel={onCancel && (() => unsavedChangesGuard.withoutBlocking(onCancel))}
        renderCreateRelationTarget={renderCreateRelationTarget}
      />
    </div>
  );
}
