import { useState } from "react";
import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { CreateEntityItemForm } from "@contentgrid/features/entity-item-create";
import { BreadCrumbsToolBarLayout } from "@contentgrid/features/layout";
import { useUnsavedChangesGuard } from "@contentgrid/features/unsaved-changes-guard";
import { type ProfileEntity, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  PageTitle,
  UnsavedChangesDialog,
} from "@contentgrid/ui";

export const Route = createFileRoute("/_app/$entity/~create")({
  component: RouteComponent,
});

function RouteComponent() {
  const { entity: entityName } = useParams({ strict: false });

  // EntityProfileGate (the parent /$entity route) already resolved and
  // validated the profile before this renders — this is a cached read.
  const { data: profile } = useProfileEntity({ name: entityName });

  if (!profile) return <LoadingPage />;

  return <CreateEntityItemRoute profile={profile} />;
}

function CreateEntityItemRoute({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const go = useNavigate();
  const [isDirty, setIsDirty] = useState(false);
  const unsavedChangesGuard = useUnsavedChangesGuard(isDirty);

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <button
            type="button"
            onClick={() => go({ to: "/", search: {} })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Home
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <button
            type="button"
            onClick={() => go({ to: "/$entity", params: { entity: profile.name }, search: {} })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {profile.pluralName}
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Create {profile.singularName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

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
          onCreated={(item) =>
            unsavedChangesGuard.withoutBlocking(() =>
              go({
                to: "/$entity/$itemId",
                params: { entity: profile.name, itemId: item.id },
                search: {},
              }),
            )
          }
          onCancel={() =>
            unsavedChangesGuard.withoutBlocking(() =>
              go({ to: "/$entity", params: { entity: profile.name }, search: {} }),
            )
          }
          renderCreateRelationTarget={(targetProfile) => (
            <Link
              to="/$entity/~create"
              params={{ entity: targetProfile.name }}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              Create {targetProfile.singularName}
            </Link>
          )}
        />
      </div>
    </BreadCrumbsToolBarLayout>
  );
}
