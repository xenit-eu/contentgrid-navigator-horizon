import { type ReactNode, useMemo } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useOpenInNewTab } from "@contentgrid/features/router-shell";
import type { Navigation } from "@contentgrid/views";
import { NavigationProvider } from "@contentgrid/views";

/**
 * The app's navigation object for views: every `open*` becomes a route change. The collection is
 * opened with an empty search, not `(prev) => prev`: filters are not carried in other pages' URLs
 * — the list restores its earlier filters and page position from the QueryClient-remembered page
 * href instead (see the list route's `onEntityItemClick`). `hrefFor` builds the same destinations
 * with the router's own `router.buildLocation(...).href`, so breadcrumbs can render real `<a href>`
 * elements (cmd/middle-click, copy link, screen-reader link semantics) instead of buttons.
 * `openCreateItem` opens the entity's create form in a new tab, same as the old per-app wiring.
 *
 * Lives in `src/routes/` with a leading `-` so TanStack Router's file-based router ignores it
 * (`routeFileIgnorePrefix`, default `"-"`) while this file still type-checks `to`/`search` against
 * this app's own registered route tree (see `main.tsx`'s `declare module "@tanstack/react-router"`)
 * — a typo'd or renamed route string fails `pnpm typecheck` here, same as any other route file.
 * `packages/views` must not import `@tanstack/react-router` at all; this is the one place in each
 * app allowed to (`packages/views/CLAUDE.md`).
 */
export function RouterNavigationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const navigate = useNavigate();
  const router = useRouter();
  const { openCreatePage } = useOpenInNewTab();
  const navigation = useMemo<Navigation>(
    () => ({
      openHome: () => void navigate({ to: "/", search: {} }),
      openEntityItemCollection: (entityName) =>
        void navigate({ to: "/$entity", params: { entity: entityName }, search: {} }),
      openItem: (entityName, id) =>
        void navigate({
          to: "/$entity/$itemId",
          params: { entity: entityName, itemId: id },
          search: (prev) => prev,
        }),
      openCreateItem: openCreatePage,
      hrefFor: {
        home: () => router.buildLocation({ to: "/", search: {} }).href,
        entityItemCollection: (entityName) =>
          router.buildLocation({ to: "/$entity", params: { entity: entityName }, search: {} }).href,
        item: (entityName, id) =>
          router.buildLocation({
            to: "/$entity/$itemId",
            params: { entity: entityName, itemId: id },
            search: (prev) => prev,
          }).href,
      },
    }),
    [navigate, router, openCreatePage],
  );
  return <NavigationProvider navigation={navigation}>{children}</NavigationProvider>;
}
