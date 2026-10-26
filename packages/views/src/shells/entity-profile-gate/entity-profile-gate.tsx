import type { ReactNode } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  type ProfileEntity,
  ensureProfileEntity,
  toProblemDisplayModel,
  useProfileEntity,
} from "@contentgrid/navigator-data";
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
 * Gate for the /$entity subtree: resolves the entity's profile once and gates both the collection
 * and item-detail pages behind it, so an unknown entity name shows one consistent error page
 * instead of each page independently loading and silently rendering blank. Takes plain props;
 * `EntityProfileGateRoute` wires it to the router and to `useViewNavigation()`.
 */
export function EntityProfileGate({
  entityName,
  onBackHome,
  children,
}: Readonly<{
  entityName: string;
  /** Called by the not-found page's "Back to home" button. */
  onBackHome: () => void;
  children: ReactNode;
}>) {
  const {
    data: profile,
    isPending,
    isError,
    error,
  } = useProfileEntity({
    name: entityName,
  });

  if (isPending) {
    return <LoadingPage />;
  }

  // A fetch failure (network/server error) is distinct from "not found" —
  // the former is retriable, the latter is a dead end pointing the user home.
  if (isError) {
    return <ErrorPage model={toProblemDisplayModel(error)} />;
  }

  if (!profile) {
    return (
      <ErrorPage
        model={toProblemDisplayModel(`Profile ${entityName} does not exist.`)}
        onRetry={onBackHome}
        retryLabel="Back to home"
      />
    );
  }

  return children;
}
