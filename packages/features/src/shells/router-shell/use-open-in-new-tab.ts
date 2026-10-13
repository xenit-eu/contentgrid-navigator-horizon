import { useRouter } from "@tanstack/react-router";

/**
 * Opens entity pages in a new browser tab — used for relation "Create" and "Details" actions.
 * Route paths are plain strings: the typed route tree lives in each app.
 */
export function useOpenInNewTab() {
  const router = useRouter();
  const open = (to: string, params: Record<string, string>) =>
    window.open(
      router.buildLocation({ to, params, search: {} }).href,
      "_blank",
      "noopener,noreferrer",
    );
  return {
    openCreatePage: (entity: string) => open("/$entity/~create", { entity }),
    openItemPage: (entity: string, itemId: string) => open("/$entity/$itemId", { entity, itemId }),
  };
}
