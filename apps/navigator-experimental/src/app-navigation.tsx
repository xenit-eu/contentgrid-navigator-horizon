import { type ReactNode, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { type Navigation, NavigationProvider } from "@contentgrid/views";

/**
 * The app's navigation object for views: every `open*` becomes a route change. Pages are opened
 * with an empty search: filters are not carried in other pages' URLs — the list restores its
 * earlier filters and page position from the QueryClient-remembered page href instead.
 */
export function AppNavigationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const navigation = useMemo<Navigation>(
    () => ({
      openHome: () => void navigate({ to: "/", search: {} }),
      openEntityItemCollection: (entityName) =>
        void navigate({ to: "/$entity", params: { entity: entityName }, search: {} }),
      openItem: (entityName, id) =>
        void navigate({
          to: "/$entity/$itemId",
          params: { entity: entityName, itemId: id },
          search: {},
        }),
      openCreateItem: (entityName) =>
        void navigate({ to: "/$entity/~create", params: { entity: entityName }, search: {} }),
    }),
    [navigate],
  );
  return <NavigationProvider navigation={navigation}>{children}</NavigationProvider>;
}
