import { useParams } from "@tanstack/react-router";
import {
  type ProfileEntity,
  ensureEntityItem,
  getErrorMessage,
  useEntityItem,
  useLoadedProfileEntities,
  useProfileEntity,
} from "@contentgrid/navigator-data";
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
import type { AppRouterContext } from "../router-shell/router-context";
import { formatAttributeValue } from "./attribute-format";
import { useTypedNavigate } from "./navigate";
import { RelationToManySection, RelationToOneSection } from "./relation-sections";

// ---------------------------------------------------------------------------
// Route loader — shared by both apps' $entity/$itemId.tsx route files.
// TanStack Router requires a per-app route file, but the prefetch logic itself
// is identical, so it lives here once instead of being copy-pasted twice.
// ---------------------------------------------------------------------------

interface EntityItemDetailLoaderContext extends AppRouterContext {
  /**
   * `null` when the parent `$entity` beforeLoad prefetch resolved to no profile,
   * absent entirely when it bailed out early — both mean "not prefetched".
   */
  profileEntity?: ProfileEntity | null;
}

export async function ensureEntityItemDetailLoaderData(
  context: EntityItemDetailLoaderContext,
  itemId: string,
): Promise<void> {
  const { queryClient, apiFetch, profileEntity } = context;
  if (!apiFetch || !profileEntity) return;

  try {
    await ensureEntityItem(queryClient, apiFetch, profileEntity, itemId);
  } catch {
    // Swallowed: an uncaught loader rejection would block EntityItemDetailPage
    // from mounting at all. useEntityItem's own isError handling takes over
    // once the component renders.
  }
}

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
  const go = useTypedNavigate();
  const item = useEntityItem({ profileEntity: profile, entityId: itemId });
  const { profiles: loadedProfiles } = useLoadedProfileEntities();

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

      {item.isError && (
        <ErrorPage message={`Failed to load item: ${getErrorMessage(item.error)}`} />
      )}

      {item.isSuccess && (
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {item.data.userDefinedAttributes.map((attr) => {
              const label =
                profile.attributes.find((a) => a.name === attr.value.name)?.title ??
                attr.value.name;
              return (
                <div key={attr.value.name} className="rounded-lg border p-4">
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate text-sm">{formatAttributeValue(attr)}</dd>
                </div>
              );
            })}
          </dl>

          {(item.data.toOneRelations.length > 0 || item.data.toManyRelations.length > 0) && (
            <>
              <Separator />
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">Relations</h2>
                {item.data.toOneRelations.map((rel) => (
                  <RelationToOneSection key={rel.name} relation={rel} profiles={loadedProfiles} />
                ))}
                {item.data.toManyRelations.map((rel) => (
                  <RelationToManySection key={rel.name} relation={rel} profiles={loadedProfiles} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
