export {
  ViewTargetNotFoundError,
  ViewTargetNotSupportedError,
  isViewTargetNotFound,
  isViewTargetNotSupported,
} from "./view-target";
export type { ResolvedViewTarget, ViewTarget } from "./view-target";
export { ensureViewTarget, resolveViewTargetIdentity } from "./resolve-view-target";
export type { ViewTargetIdentity } from "./resolve-view-target";
export { useViewTarget } from "./use-view-target";
export type { UseViewTargetResult } from "./use-view-target";
