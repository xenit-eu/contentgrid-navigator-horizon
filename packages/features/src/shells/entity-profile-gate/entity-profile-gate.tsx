import { Outlet, useNavigate, useParams } from "@tanstack/react-router";
import {
  type ProfileEntity,
  ensureProfileEntity,
  toProblemDisplayModel,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { ErrorPage, LoadingPage } from "@contentgrid/ui";
import { ProblemAlert } from "../../problem-details";
import type { AppRouterContext } from "../router-shell";

// ---------------------------------------------------------------------------
// Route loader — shared by both apps' $entity.tsx route files.
// ---------------------------------------------------------------------------

export async function ensureEntityProfileLoaded(
  context: AppRouterContext,
  entityName: string,
): Promise<{ profileEntity?: ProfileEntity | null }> {
  const { queryClient, apiFetch, profileUrl } = context;
  // apiFetch/profileUrl are null until the router-context bridge in main.tsx
  // fires (auth-gated) — skip prefetching until then and let
  // EntityProfileGate's own useProfileEntity() fetch normally. A prefetch
  // failure here is swallowed the same way: an uncaught beforeLoad rejection
  // would block EntityProfileGate's component from mounting at all, skipping
  // its own LoadingPage/ErrorPage handling entirely.
  if (!apiFetch || !profileUrl) return {};
  try {
    const profileEntity = await ensureProfileEntity(queryClient, apiFetch, profileUrl, {
      name: entityName,
    });
    return { profileEntity };
  } catch {
    return {};
  }
}

/**
 * Layout for the /$entity subtree: resolves the entity's profile once and
 * gates both the collection and item-detail pages behind it, so an unknown
 * entity name shows one consistent error page instead of each page
 * independently loading and silently rendering blank.
 */
export function EntityProfileGate() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const go = useNavigate();
  const {
    data: profile,
    isPending,
    isError,
    error,
  } = useProfileEntity({
    name: entityName,
  });

  if (isPending) {
    return <LoadingPage rows={5} />;
  }

  // A fetch failure (network/server error) is distinct from "not found" —
  // the former is retriable, the latter is a dead end pointing the user home.
  if (isError) {
    return <ProblemAlert model={toProblemDisplayModel(error)} />;
  }

  if (!profile) {
    return (
      <ErrorPage
        message={`"${entityName}" is not a known entity.`}
        onRetry={() => go({ to: "/", search: {} })}
        retryLabel="Back to home"
      />
    );
  }

  return <Outlet />;
}
