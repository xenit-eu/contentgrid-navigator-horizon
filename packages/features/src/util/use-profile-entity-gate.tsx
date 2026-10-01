import type { ReactElement } from "react";
import {
  type ProfileEntity,
  toProblemDisplayModel,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { ErrorPage, LoadingPage } from "../app-info-pages";

export type ProfileEntityGate =
  | { readonly status: "ready"; readonly profileEntity: ProfileEntity; readonly element: null }
  | {
      readonly status: "pending" | "error" | "not-found";
      readonly profileEntity: undefined;
      /** The shared loading / error / not-found page to render instead of the view. */
      readonly element: ReactElement;
    };

export interface UseProfileEntityGateOptions {
  /** Action offered on the not-found page (e.g. "Back to home"); omitted when absent. */
  readonly notFoundAction?: { readonly label: string; readonly onClick: () => void };
}

/**
 * The one shared loading / error / not-found gate for a view that needs a `ProfileEntity`
 * (constitution Principle VIII). Resolves the profile by entity name and returns either the
 * profile (`status: "ready"`) or the page element to render in its place — so views don't each
 * hand-roll the same three-way branch.
 *
 * ```tsx
 * const gate = useProfileEntityGate(entityName);
 * if (gate.status !== "ready") return gate.element;
 * ```
 */
export function useProfileEntityGate(
  entityName: string,
  options?: UseProfileEntityGateOptions,
): ProfileEntityGate {
  const {
    data: profileEntity,
    isPending,
    isError,
    error,
    refetch,
  } = useProfileEntity({
    name: entityName,
  });

  if (isPending) {
    return { status: "pending", profileEntity: undefined, element: <LoadingPage /> };
  }
  if (isError) {
    return {
      status: "error",
      profileEntity: undefined,
      element: <ErrorPage model={toProblemDisplayModel(error)} onRetry={() => void refetch()} />,
    };
  }
  if (!profileEntity) {
    return {
      status: "not-found",
      profileEntity: undefined,
      element: (
        <ErrorPage
          model={toProblemDisplayModel(`Profile ${entityName} does not exist.`)}
          onRetry={options?.notFoundAction?.onClick}
          retryLabel={options?.notFoundAction?.label}
        />
      ),
    };
  }
  return { status: "ready", profileEntity, element: null };
}
