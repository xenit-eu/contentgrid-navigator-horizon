import type { ReactNode } from "react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import {
  type ProblemDisplayModel,
  type ProfileEntity,
  type ResolvedViewTarget,
  type UseViewTargetResult,
  isViewTargetNotFound,
  toProblemDisplayModel,
} from "@contentgrid/navigator-data";

function toDisplayModel(error: Error): ProblemDisplayModel {
  if (isViewTargetNotFound(error)) {
    return { kind: "notFound", status: 404, title: "Not found", detail: error.message };
  }
  return toProblemDisplayModel(error);
}

export interface ViewTargetGateProps {
  /** The result of `useViewTarget` for the view's main data. */
  readonly result: UseViewTargetResult;
  /**
   * Wraps the loading and error states once the profile is known, so a view keeps its toolbar
   * around them. Without it (or before the profile is known) they fill the whole view.
   */
  readonly renderChrome?: (profileEntity: ProfileEntity, state: ReactNode) => ReactNode;
  /** Rendered once the target resolved. */
  readonly children: (resolved: ResolvedViewTarget) => ReactNode;
}

/**
 * The one loading, error and not-found state of a view's main data (constitution Principle VIII,
 * FR-006). Not-found targets, unsupported links and failed requests all end up here, so views do
 * not each draw their own.
 */
export function ViewTargetGate({ result, renderChrome, children }: Readonly<ViewTargetGateProps>) {
  if (result.data) return <>{children(result.data)}</>;

  let state: ReactNode;
  if (result.isError && result.error) {
    state = <ErrorPage model={toDisplayModel(result.error)} />;
  } else {
    state = <LoadingPage />;
  }
  return (
    <>{result.profileEntity && renderChrome ? renderChrome(result.profileEntity, state) : state}</>
  );
}
