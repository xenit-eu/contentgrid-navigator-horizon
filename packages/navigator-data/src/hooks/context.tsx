import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { TypedFetch } from "../api/client";

export interface NavigatorDataContextValue {
  /** Authenticated TypedFetch for HAL GET requests (fetchHal / fetchHalSlice). */
  apiFetch: TypedFetch;
  /**
   * Authenticated TypedFetch for binary content requests (PUT/GET to cg:content links).
   *
   * Unlike `apiFetch`, this client does NOT set `Accept: application/hal+json`. Use it
   * exclusively for binary content operations (`useUploadContent` / `useDownloadContent`).
   * Built from `createContentClient` — see `src/api/client.ts`.
   */
  contentFetch: TypedFetch;
  /**
   * Full URL of the HAL-FORMS profile root, e.g. https://api.example.com/profile.
   * Resolved once by the app (typically from the root resource's cg:entity links or
   * the app's known ContentGrid deployment URL) and injected here so the hooks
   * do not need to re-discover it on every render.
   */
  profileUrl: string;
  /**
   * URI template for the PDF rendition service (contains a `{?url}` expansion), from
   * `RuntimeAppConfig.renditionUri`. Absent means renditions are disabled —
   * `useContentPreview` returns `{ kind: "unavailable" }` for any non-PDF content
   * attribute instead of requesting a rendition. See `preview/rendition-job.ts`.
   */
  renditionUri?: string;
  /**
   * Poll interval and ceiling for rendition jobs, from `RuntimeAppConfig`. Populated
   * (with defaults applied) by `useAppAuth` whenever `renditionUri` is set; a caller
   * providing `renditionUri` without `renditionPolling` is a configuration bug, not a
   * state `useContentPreview` needs to handle — see `hooks/preview/use-content-preview.ts`.
   */
  renditionPolling?: { intervalMs: number; timeoutMs: number };
}

const NavigatorDataContext = createContext<NavigatorDataContextValue | null>(null);

export function NavigatorDataProvider({
  apiFetch,
  contentFetch,
  profileUrl,
  renditionUri,
  renditionPolling,
  children,
}: NavigatorDataContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ apiFetch, contentFetch, profileUrl, renditionUri, renditionPolling }),
    [apiFetch, contentFetch, profileUrl, renditionUri, renditionPolling],
  );
  return <NavigatorDataContext.Provider value={value}>{children}</NavigatorDataContext.Provider>;
}

export function useNavigatorData(): NavigatorDataContextValue {
  const ctx = useContext(NavigatorDataContext);
  if (!ctx) {
    throw new Error("useNavigatorData must be used within <NavigatorDataProvider>");
  }
  return ctx;
}
