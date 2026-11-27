import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  CreateEntityItemPanel,
  CreateEntityItemProfileSelector,
} from "@contentgrid/features/entity-item-create";
import { type ProfileEntity, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";
import { BreadCrumbsToolBarLayout } from "@contentgrid/views/layout";
import { useOpenInNewTab } from "@contentgrid/views/router-shell";

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
  const { openCreatePage, openItemPage } = useOpenInNewTab();

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button type="button" onClick={() => go({ to: "/", search: {} })}>
              Home
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <button
              type="button"
              onClick={() => go({ to: "/$entity", params: { entity: profile.name }, search: {} })}
            >
              {profile.pluralName}
            </button>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>Create {profile.singularName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <BreadCrumbsToolBarLayout
      breadcrumbs={breadcrumbs}
      actions={
        <CreateEntityItemProfileSelector
          selectedProfile={profile}
          onSelect={(next) =>
            go({ to: "/$entity/~create", params: { entity: next.name }, search: {} })
          }
        />
      }
    >
      {/* Keyed on the entity: switching entity keeps this route mounted, the form must not. */}
      <CreateEntityItemPanel
        key={profile.name}
        profile={profile}
        onCreated={(item) =>
          go({
            to: "/$entity/$itemId",
            params: { entity: profile.name, itemId: item.id },
            search: {},
          })
        }
        onCancel={() => go({ to: "/$entity", params: { entity: profile.name }, search: {} })}
        onRelationItemClick={openItemPage}
        onRelationItemCreateNew={openCreatePage}
      />
    </BreadCrumbsToolBarLayout>
  );
}
