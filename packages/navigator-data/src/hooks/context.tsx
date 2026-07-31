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
   * Factory for a progress-reporting binary upload client.
   *
   * Returns a TypedFetch backed by XMLHttpRequest (fetch cannot report upload
   * progress) wrapped in the SAME bearer-auth + problem-details hook chain as
   * `contentFetch`. A factory rather than a plain client because the progress
   * callback is per-upload. Use only for content PUTs that need progress.
   */
  createContentUploadFetch: (onProgress?: (percentage: number) => void) => TypedFetch;
  /**
   * Full URL of the HAL-FORMS profile root, e.g. https://api.example.com/profile.
   * Resolved once by the app (typically from the root resource's cg:entity links or
   * the app's known ContentGrid deployment URL) and injected here so the hooks
   * do not need to re-discover it on every render.
   */
  profileUrl: string;
}

const NavigatorDataContext = createContext<NavigatorDataContextValue | null>(null);

export function NavigatorDataProvider({
  apiFetch,
  contentFetch,
  createContentUploadFetch,
  profileUrl,
  children,
}: NavigatorDataContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ apiFetch, contentFetch, createContentUploadFetch, profileUrl }),
    [apiFetch, contentFetch, createContentUploadFetch, profileUrl],
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
