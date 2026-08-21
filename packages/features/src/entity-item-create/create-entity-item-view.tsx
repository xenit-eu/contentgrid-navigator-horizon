import { type ReactNode, useState } from "react";
import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { PageTitle, UnsavedChangesDialog } from "@contentgrid/ui";
import { BreadCrumbsToolBarLayout } from "../layout";
import { useUnsavedChangesGuard } from "../unsaved-changes-guard";
import { CreateEntityItemForm } from "./create-entity-item-form";

export interface CreateEntityItemViewProps {
  readonly profile: ProfileEntity;
  /** Breadcrumb trail shown in the toolbar; built by the caller since it needs router navigation. */
  readonly breadcrumbs?: ReactNode;
  /** Fired after the item is created, once any unsaved-changes block has been lifted. */
  readonly onCreated?: (item: EntityItem) => void;
  /** Renders a cancel button next to submit when provided. */
  readonly onCancel?: () => void;
  readonly renderCreateRelationTarget?: (targetProfile: ProfileEntity) => ReactNode;
}

/**
 * App-agnostic create-item page: wraps `CreateEntityItemForm` with the shared
 * page chrome (breadcrumb toolbar, title, unsaved-changes guard). All routing
 * / navigation is supplied by the caller through `breadcrumbs`, `onCreated`,
 * and `onCancel` — this component performs no navigation itself.
 */
export function CreateEntityItemView({
  profile,
  breadcrumbs,
  onCreated,
  onCancel,
  renderCreateRelationTarget,
}: Readonly<CreateEntityItemViewProps>) {
  const [isDirty, setIsDirty] = useState(false);
  const unsavedChangesGuard = useUnsavedChangesGuard(isDirty);

  return (
    <BreadCrumbsToolBarLayout breadcrumbs={breadcrumbs}>
      <div className="space-y-6 p-4 pt-0">
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
    </BreadCrumbsToolBarLayout>
  );
}
