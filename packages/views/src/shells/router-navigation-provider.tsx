import { type ReactNode, useMemo } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { NavigationProvider } from "../navigation";
import type { Navigation } from "../navigation";

/**
 * The app's navigation object for views: every `open*` becomes a route change. The collection is
 * opened with an empty search, not `(prev) => prev`: filters are not carried in other pages' URLs
 * — the list restores its earlier filters and page position from the QueryClient-remembered page
 * href instead (see the list route's `onEntityItemClick`). `hrefFor` builds the same destinations
 * with the router's own `router.buildLocation(...).href`, so breadcrumbs can render real `<a href>`
 * elements (cmd/middle-click, copy link, screen-reader link semantics) instead of buttons.
 *
 * Lives under `packages/views/src/shells/`, not the package's main export: this is the one place
 * outside `apps/*` allowed to import `@tanstack/react-router` (root `CLAUDE.md`).
 */
export function RouterNavigationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const router = useRouter();
  const navigation = useMemo<Navigation>(
    () => ({
      openHome: () => void navigate({ to: "/", search: {} }),
      openEntityItemCollection: (entityName) =>
        void navigate({ to: "/$entity", params: { entity: entityName }, search: {} }),
      openItem: (entityName, id) =>
        void navigate({
          to: "/$entity/$itemId",
          params: { entity: entityName, itemId: id },
          search: (prev: Record<string, unknown>) => prev,
        }),
      hrefFor: {
        home: () => router.buildLocation({ to: "/", search: {} }).href,
        entityItemCollection: (entityName) =>
          router.buildLocation({ to: "/$entity", params: { entity: entityName }, search: {} }).href,
        item: (entityName, id) =>
          router.buildLocation({
            to: "/$entity/$itemId",
            params: { entity: entityName, itemId: id },
            search: (prev: Record<string, unknown>) => prev,
          }).href,
      },
    }),
    [navigate, router],
  );
  return <NavigationProvider navigation={navigation}>{children}</NavigationProvider>;
}
