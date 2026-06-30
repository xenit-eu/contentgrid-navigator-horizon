import { type ReactNode, createContext, useContext, useMemo } from "react";
import type { TypedFetch } from "../api/client";

export interface NavigatorDataContextValue {
  /** Authenticated TypedFetch for HAL GET requests (fetchHal / fetchHalSlice). */
  apiFetch: TypedFetch;
  /**
   * Authenticated TypedFetch for binary content requests — omits `Accept: application/hal+json`.
   * Use for PUT/GET to cg:content links.
   */
  contentFetch: TypedFetch;
  /**
   * Returns the current raw Bearer token string, or null when unauthenticated.
   * Used by XHR-based uploads which cannot go through TypedFetch.
   */
  getToken: () => Promise<string | null>;
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
  getToken,
  profileUrl,
  children,
}: NavigatorDataContextValue & { children: ReactNode }) {
  const value = useMemo(
    () => ({ apiFetch, contentFetch, getToken, profileUrl }),
    [apiFetch, contentFetch, getToken, profileUrl],
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
