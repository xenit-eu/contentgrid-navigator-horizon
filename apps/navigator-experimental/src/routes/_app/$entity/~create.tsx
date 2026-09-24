import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { CreateEntityItemView } from "@contentgrid/features/entity-item-create";
import { BreadCrumbsToolBarLayout } from "@contentgrid/features/layout";
import { useOpenInNewTab } from "@contentgrid/features/router-shell";
import { type ProfileEntity, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
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
  const { openCreatePage, openItemPage } = useOpenInNewTab();

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
      <CreateEntityItemView
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
