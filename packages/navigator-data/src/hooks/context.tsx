import { type ReactNode, createContext, useContext } from "react";
import type { TypedFetch } from "../api/client";

export interface NavigatorDataContextValue {
  /** Authenticated TypedFetch for HAL GET requests (fetchHal / fetchHalSlice). */
  apiFetch: TypedFetch;
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
  profileUrl,
  children,
}: NavigatorDataContextValue & { children: ReactNode }) {
  return (
    <NavigatorDataContext.Provider value={{ apiFetch, profileUrl }}>
      {children}
    </NavigatorDataContext.Provider>
  );
}

export function useNavigatorData(): NavigatorDataContextValue {
  const ctx = useContext(NavigatorDataContext);
  if (!ctx) {
    throw new Error("useNavigatorData must be used within <NavigatorDataProvider>");
  }
  return ctx;
}
