import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { LoadingPage } from "@contentgrid/features/app-info-pages";
import { BreadCrumbsToolBarLayout } from "@contentgrid/features/layout";
import { EntityConfigurationDetail } from "@contentgrid/features/preferences";
import { type ProfileEntity, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";

export const Route = createFileRoute("/_app/~configuration/$entity")({
  component: ConfigurationDetailPage,
});

function ConfigurationDetailPage() {
  const { entity: entityName } = useParams({ strict: false });
  const { data: profile } = useProfileEntity({ name: entityName });

  if (!profile) return <LoadingPage />;

  return <ConfigurationDetailRoute profile={profile} />;
}

function ConfigurationDetailRoute({ profile }: Readonly<{ profile: ProfileEntity }>) {
  const go = useNavigate();

  const breadcrumbs = (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <button
            type="button"
            onClick={() => go({ to: "/~configuration" as string })}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Settings
          </button>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{profile.pluralName}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );

  return (
    <BreadCrumbsToolBarLayout breadcrumbs={breadcrumbs}>
      <EntityConfigurationDetail
        profile={profile}
        onClose={() => go({ to: "/~configuration" as string })}
      />
    </BreadCrumbsToolBarLayout>
  );
}
