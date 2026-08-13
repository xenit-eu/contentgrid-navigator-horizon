import { skipToken } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import {
  type ProfileEntity,
  toProblemDisplayModel,
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
  Separator,
} from "@contentgrid/ui";
import { LoadingPage } from "../app-info-pages/loading-page";
import { ProblemAlert } from "../problem-details";
import type { AppRouterContext } from "../shells/router-shell/router-context";
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder loader; itemId used once real prefetch call is added
  itemId: string,
): Promise<void> {
  const { apiFetch, profileEntity } = context;
  if (!apiFetch || !profileEntity) return;

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- placeholder loader; real prefetch call replaces this
    skipToken;
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

      {item.isPending && <LoadingPage />}

      {item.isError && <ProblemAlert model={toProblemDisplayModel(item.error)}></ProblemAlert>}

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
