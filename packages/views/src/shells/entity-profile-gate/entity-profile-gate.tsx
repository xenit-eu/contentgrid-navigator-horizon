import type { ReactNode } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { ensureProfileEntityLoaded } from "../../preload/ensure-profile-entity";
import type { AppRouterContext } from "../router-shell";

// ---------------------------------------------------------------------------
// Route loader — shared by both apps' $entity.tsx route files.
// ---------------------------------------------------------------------------

export async function ensureEntityProfileLoaded(
  context: AppRouterContext,
  entityName: string,
): Promise<{ profileEntity?: ProfileEntity | null }> {
  // Skips (returns `{}`) while the API client is absent and swallows a failure: see
  // `ensureProfileEntityLoaded`. EntityProfileGate's own useProfileEntity() then fetches normally
  // and draws its own LoadingPage/ErrorPage.
  const profileEntity = await ensureProfileEntityLoaded(context, entityName);
  return profileEntity === undefined ? {} : { profileEntity };
}

/**
 * Gate for the /$entity subtree: resolves the entity's profile once and gates both the collection
 * and item-detail pages behind it, so an unknown entity name shows one consistent error page
 * instead of each page independently loading and silently rendering blank. Takes plain props;
 * each app's `EntityGateRoute` (in its `$entity` route files) wires it to the router and to
 * `useViewNavigation()`.
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
