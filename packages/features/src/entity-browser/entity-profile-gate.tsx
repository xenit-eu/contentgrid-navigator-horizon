import { Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useProfileEntity } from "@contentgrid/navigator-data";
import { ErrorPage, LoadingPage } from "@contentgrid/ui";
import type { AnyNavigateFn } from "./navigate";

/**
 * Layout for the /$entity subtree: resolves the entity's profile once and
 * gates both the collection and item-detail pages behind it, so an unknown
 * entity name shows one consistent error page instead of each page
 * independently loading and silently rendering blank.
 */
export function EntityProfileGate() {
  const { entity: entityName } = useParams({ strict: false }) as { entity: string };
  const navigate = useNavigate();
  const go = navigate as unknown as AnyNavigateFn;
  const {
    data: profile,
    isPending,
    isError,
    error,
    refetch,
  } = useProfileEntity({
    name: entityName,
  });

  if (isPending) {
    return <LoadingPage rows={5} />;
  }

  // A fetch failure (network/server error) is distinct from "not found" —
  // the former is retriable, the latter is a dead end pointing the user home.
  if (isError) {
    return (
      <ErrorPage
        message={`Failed to load "${entityName}": ${error.message}`}
        onRetry={() => refetch()}
        retryLabel="Retry"
      />
    );
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
