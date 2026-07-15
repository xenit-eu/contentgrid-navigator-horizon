import { useNavigate, useParams } from "@tanstack/react-router";
import { type ProfileEntity, useEntityItem, useProfileEntity } from "@contentgrid/navigator-data";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  ErrorPage,
  LoadingPage,
  Separator,
} from "@contentgrid/ui";
import { formatAttributeValue } from "./attribute-format";
import type { AnyNavigateFn } from "./navigate";

// ---------------------------------------------------------------------------
// EntityItemDetailPage — $entity/$itemId route component
// ---------------------------------------------------------------------------

export function EntityItemDetailPage() {
  const { entity: entityName, itemId } = useParams({ strict: false }) as {
    entity: string;
    itemId: string;
  };

  // EntityProfileGate (the parent /$entity route) already resolved and
  // validated the profile before this renders — this is a cached read.
  const { data: profile } = useProfileEntity({ name: entityName });

  if (!profile) return null;

  return <EntityItemDetailView profile={profile} itemId={itemId} />;
}

function EntityItemDetailView({
  profile,
  itemId,
}: Readonly<{ profile: ProfileEntity; itemId: string }>) {
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;
  const item = useEntityItem({ profileEntity: profile, entityId: itemId });

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <button
              type="button"
              onClick={() => go({ to: "/", search: {} })}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              All entities
            </button>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <button
              type="button"
              onClick={() =>
                // Restores whatever search state (e.g. cursor) the list page
                // was carried here with — see entity-detail.tsx's onRowClick.
                go({
                  to: "/$entity",
                  params: { entity: profile.name },
                  search: (prev) => prev,
                })
              }
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {profile.pluralName}
            </button>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{itemId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Separator />

      <h1 className="text-2xl font-bold tracking-tight">{profile.pluralName} detail</h1>

      {item.isPending && <LoadingPage rows={4} />}

      {item.isError && <ErrorPage message={`Failed to load item: ${item.error.message}`} />}

      {item.isSuccess && (
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {item.data.userDefinedAttributes.map((attr) => {
            const label =
              profile.attributes.find((a) => a.name === attr.value.name)?.title ?? attr.value.name;
            return (
              <div key={attr.value.name} className="rounded-lg border p-4">
                <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                <dd className="mt-1 truncate text-sm">{formatAttributeValue(attr)}</dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
