import type { MouseEvent, ReactNode } from "react";
import { AttributeKind, type ContentMetadata, type EntityItem } from "@contentgrid/navigator-data";
import { IconBadge, formatFileSize } from "@contentgrid/ui";
import { FileTile } from "../entity-item/attributes/renderers/file-tile";
import { selectDefaultContentAttribute } from "../entity-item/variations/content-focus";
import { useEntityItemHeading } from "../entity-item/variations/item-reference/use-entity-item-heading";

export interface EntityItemTitleCellProps {
  readonly item: EntityItem;
  /** Opens the item's own page. Without it (and without `href`) the title is plain text. */
  readonly onOpen?: (item: EntityItem) => void;
  /** The item page's address, when the host has one, so the title is a real link. */
  readonly href?: string;
}

/** The item's file, from its first content attribute; `undefined` when the entity has none. */
function findFile(item: EntityItem): { metadata: ContentMetadata | null } | undefined {
  const name = selectDefaultContentAttribute(item.profileEntity, item);
  if (name === undefined) return undefined;
  const value = item.findAttribute(name)?.value;
  return { metadata: value?.kind === AttributeKind.CONTENT ? value.metadata : null };
}

/**
 * The first cell of a collection row: a tile, the item's title as a link to its page, and a muted
 * line under it. For an entity with a content attribute the tile is a neutral file tile and the
 * line is "name.pdf · 412 KB" (or "No file"); for any other entity the tile is the entity's icon
 * and the line is the subtitle from its display settings.
 *
 * The link never reaches the row: following it must not also preview the item.
 */
export function EntityItemTitleCell({ item, onOpen, href }: Readonly<EntityItemTitleCellProps>) {
  const { preferences, Icon, title, subtitle: itemSubtitle } = useEntityItemHeading(item);
  const file = findFile(item);

  let subtitle: ReactNode = itemSubtitle;
  if (file) {
    subtitle = file.metadata
      ? `${file.metadata.filename ?? "Untitled"} · ${formatFileSize(file.metadata.length)}`
      : "No file";
  }

  function handleClick(event: MouseEvent<HTMLElement>) {
    // Never the row's click, which previews the item.
    event.stopPropagation();
    // A modifier or middle click on a real link is left to the browser (new tab).
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Without a handler the link is left to the browser, rather than made dead.
    if (!onOpen) return;
    event.preventDefault();
    onOpen(item);
  }

  const linkClassName =
    "block max-w-full truncate rounded-sm text-left font-semibold text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";
  let heading: ReactNode = title;
  if (href !== undefined) {
    heading = (
      <a href={href} onClick={handleClick} className={linkClassName}>
        {title}
      </a>
    );
  } else if (onOpen) {
    heading = (
      <button type="button" onClick={handleClick} className={linkClassName}>
        {title}
      </button>
    );
  }

  return (
    <div data-slot="entity-item-title-cell" className="flex min-w-0 items-center gap-2.5">
      {file ? (
        <FileTile mimetype={file.metadata?.mimetype} />
      ) : (
        <IconBadge icon={<Icon />} color={preferences.color} variant="sm" />
      )}
      <div className="min-w-0">
        <div
          className={`truncate text-[13px] text-foreground ${href === undefined && !onOpen ? "font-semibold" : ""}`}
        >
          {heading}
        </div>
        {subtitle !== undefined && (
          <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
