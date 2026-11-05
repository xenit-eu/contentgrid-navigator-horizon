import type { ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react";
import { ErrorPage, LoadingPage } from "@contentgrid/features/app-info-pages";
import { EntityItemPreview, EntityItemReference } from "@contentgrid/features/entity-item";
import { toProblemDisplayModel } from "@contentgrid/navigator-data";
import { Button, buttonVariants } from "@contentgrid/ui";
import { useEntityItemTarget } from "../hooks/use-entity-item-target";
import { NavigationLink, useViewNavigation } from "../navigation";
import type { ViewProps } from "../types/view";

export type EntityItemPreviewViewProps = ViewProps & {
  /** Profile entity name — never the plural path. */
  readonly entityName: string;
  /** The item's `id` field. */
  readonly itemId: string;
  /**
   * Called when the user closes the preview. The close button only shows when it is given: the
   * view has no state of its own, so the host decides what closing means.
   */
  readonly onClose?: () => void;
};

/**
 * A read-only preview of one entity item, for a pane next to a list: its content when it holds a
 * file, otherwise its attributes. No edit, delete or relation controls — "Open" goes to the full
 * detail view through `useViewNavigation()` (a real link when the host has an address for it, so
 * modified clicks open a new tab). The toolbar is an item reference with Open, Close (when
 * `onClose` is given) and the host's `toolbar.actions`; `toolbar={false}` draws none. Loading,
 * error and not-found states show in the pane.
 */
export function EntityItemPreviewView({
  entityName,
  itemId,
  toolbar,
  onClose,
}: Readonly<EntityItemPreviewViewProps>) {
  const navigation = useViewNavigation();
  const result = useEntityItemTarget({ entityName, itemId });

  let content: ReactNode;
  if (result.status === "not-found") {
    content = <ErrorPage model={toProblemDisplayModel(`No profile for entity "${entityName}"`)} />;
  } else if (result.status === "error") {
    content = <ErrorPage model={toProblemDisplayModel(result.error)} />;
  } else if (result.status === "success") {
    content = <EntityItemPreview item={result.entityItem} />;
  } else {
    content = <LoadingPage />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {toolbar !== false && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-4 py-2">
          <div className="min-w-0">
            {result.status === "success" && (
              <EntityItemReference item={result.entityItem} size="sm" />
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {toolbar?.actions}
            <NavigationLink
              href={navigation.hrefFor?.item(entityName, itemId)}
              onNavigate={() => navigation.openItem(entityName, itemId)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Open
            </NavigationLink>
            {onClose && (
              <Button variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}>
                <XIcon aria-hidden />
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="min-h-0 flex-1">{content}</div>
    </div>
  );
}
