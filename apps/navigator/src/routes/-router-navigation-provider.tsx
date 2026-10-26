import { type ReactNode, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import {
  rememberCollectionFilters,
  rememberCollectionPageHref,
  rememberCollectionSort,
} from "@contentgrid/navigator-data";
import type { Navigation, NavigationOptions } from "@contentgrid/views";
import { NavigationProvider } from "@contentgrid/views";

/**
 * The app's navigation object for views: every `open*` becomes a route change. The collection is
 * opened with an empty search, not `(prev) => prev`: filters are not carried in other pages' URLs
 * — the list restores its earlier filters and page position from the QueryClient-remembered page
 * href instead (see the list route's `onEntityItemClick`). `hrefFor` builds the same destinations
 * with the router's own `router.buildLocation(...).href`, so breadcrumbs can render real `<a href>`
 * elements (cmd/middle-click, copy link, screen-reader link semantics) instead of buttons.
 * Every `open*` honours `options.openInNewTab` by opening the same destination href with
 * `window.open(href, "_blank", "noopener,noreferrer")` instead of navigating the current tab.
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
  const queryClient = useQueryClient();
  const navigation = useMemo<Navigation>(() => {
    const hrefs = {
      home: () => router.buildLocation({ to: "/", search: {} }).href,
      entityItemCollection: (entityName: string) =>
        router.buildLocation({ to: "/$entity", params: { entity: entityName }, search: {} }).href,
      item: (entityName: string, id: string) =>
        router.buildLocation({
          to: "/$entity/$itemId",
          params: { entity: entityName, itemId: id },
          search: (prev) => prev,
        }).href,
      classifyCreate: () => router.buildLocation({ to: "/~create", search: {} }).href,
      settings: () => router.buildLocation({ to: "/~configuration", search: {} }).href,
      createItem: (entityName: string) =>
        router.buildLocation({ to: "/$entity/~create", params: { entity: entityName }, search: {} })
          .href,
    };
    /** A new tab gets the destination's href; otherwise the current tab navigates as `inTab` says. */
    const open = (
      href: () => string,
      options: NavigationOptions | undefined,
      inTab: () => void,
    ) => {
      if (options?.openInNewTab) window.open(href(), "_blank", "noopener,noreferrer");
      else inTab();
    };
    return {
      openHome: (options) =>
        open(hrefs.home, options, () => void navigate({ to: "/", search: {} })),
      openEntityItemCollection: (entityName, options) => {
        // The list restores its remembered filters, sort and page when it opens on a clean URL;
        // `restoreState: false` forgets them first, so it opens fresh.
        if (options?.restoreState === false) {
          rememberCollectionFilters(queryClient, entityName, {});
          rememberCollectionSort(queryClient, entityName, undefined);
          rememberCollectionPageHref(queryClient, entityName, undefined);
        }
        open(
          () => hrefs.entityItemCollection(entityName),
          options,
          () => void navigate({ to: "/$entity", params: { entity: entityName }, search: {} }),
        );
      },
      openItem: (entityName, id, options) =>
        open(
          () => hrefs.item(entityName, id),
          options,
          () =>
            void navigate({
              to: "/$entity/$itemId",
              params: { entity: entityName, itemId: id },
              search: (prev) => prev,
            }),
        ),
      openCreateItem: (entityName, options) =>
        open(
          () => hrefs.createItem(entityName),
          options,
          () =>
            void navigate({ to: "/$entity/~create", params: { entity: entityName }, search: {} }),
        ),
      openClassifyCreate: (options) =>
        open(hrefs.classifyCreate, options, () => void navigate({ to: "/~create", search: {} })),
      openSettings: (options) =>
        open(hrefs.settings, options, () => void navigate({ to: "/~configuration", search: {} })),
      hrefFor: {
        home: hrefs.home,
        entityItemCollection: hrefs.entityItemCollection,
        item: hrefs.item,
      },
    };
  }, [navigate, router, queryClient]);
  return <NavigationProvider navigation={navigation}>{children}</NavigationProvider>;
}
