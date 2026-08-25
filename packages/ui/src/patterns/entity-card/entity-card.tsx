import type { ReactNode } from "react";
import { DatabaseIcon as Database } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "../../primitives/card";

export interface EntityCardProps {
  /** Unique identifier / URL-safe name for this entity (passed to `onTitleClick`) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Optional description shown below the title */
  description?: string;
  /** Rendered left of the title. Defaults to a generic Database icon. */
  icon?: ReactNode;
  /**
   * Tints the badge behind `icon` with a soft fill of this color (e.g. the entity's chosen
   * display color). Only affects the icon's badge, not the rest of the card. Omitted
   * entirely (no badge styling) when not provided.
   */
  color?: string;
  /**
   * Rendered in the header's top-right corner (e.g. a "create" button). Sits above the
   * title button's full-card click overlay, so it stays independently clickable. Omitted
   * entirely when not provided.
   */
  action?: ReactNode;
  /** Card body — a stat, a preview, or anything else. Omitted entirely when not provided. */
  children?: ReactNode;
  /** Called when the user clicks the card title / the card itself */
  onTitleClick?: (name: string) => void;
}

export function EntityCard({
  name,
  title,
  description,
  icon,
  color,
  action,
  children,
  onTitleClick,
}: Readonly<EntityCardProps>) {
  return (
    <Card className="group relative transition-colors hover:border-primary/50">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-start gap-2">
          {/* Sibling of the title button (not nested inside it) and raised via `relative
              z-10`, same trick as `action` below — so this badge can host its own
              interactive content (e.g. a ColorPicker) without also triggering the title
              button's full-card click overlay. */}
          <span
            data-slot="entity-card-icon"
            className="relative z-10 flex items-center justify-center rounded-md p-2"
            style={
              color
                ? { backgroundColor: `color-mix(in oklch, ${color} 18%, transparent)` }
                : undefined
            }
          >
            {icon ?? <Database className="h-5 w-5 text-muted-foreground" aria-hidden />}
          </span>
          <div>
            <CardTitle className="text-lg">
              <button
                type="button"
                className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md after:absolute after:inset-0 after:content-['']"
                onClick={() => onTitleClick?.(name)}
              >
                {title}
              </button>
            </CardTitle>
            {description && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="relative z-10">{action}</div>}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
