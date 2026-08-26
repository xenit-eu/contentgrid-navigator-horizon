import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { PageTitle, type PageTitleProps } from "../../primitives";
import { Card, CardContent, CardHeader } from "../../primitives/card";

export interface EntityCardProps {
  /** Unique identifier / URL-safe name for this entity (passed to `onCardClick`) */
  name: string;
  /** Small eyebrow label rendered above the title. Omitted entirely when not provided. */
  header?: string;
  /** Human-readable title */
  title: string;
  /** Optional description shown below the title */
  description?: string;
  /** Forwarded to the title block's `PageTitle` as its `size`. Defaults to `"compact"` —
   * EntityCard's normal density. */
  titleVariant?: NonNullable<PageTitleProps["size"]>;
  /** Rendered left of the title. Defaults to a generic Database icon. Interactive content
   * inside it (e.g. a color picker trigger) does not trigger `onCardClick`. */
  icon?: ReactNode;
  /**
   * Rendered in the header's top-right corner (e.g. a "create" button). Independently
   * clickable — does not trigger `onCardClick`. Omitted entirely when not provided.
   */
  action?: ReactNode;
  /** Card body — a stat, a preview, or anything else. Omitted entirely when not provided. */
  children?: ReactNode;
  /** Called when the user clicks anywhere on the card outside `action`/interactive icon
   * content. Omitted entirely (a plain, non-interactive card) when not provided. */
  onCardClick?: (name: string) => void;
}

export function EntityCard({
  name,
  header,
  title,
  description,
  icon,
  action,
  children,
  onCardClick,
  titleVariant = "compact",
}: Readonly<EntityCardProps>) {
  return (
    <Card
      data-slot="entity-card"
      className={cn(
        "group relative transition-colors",
        onCardClick && "cursor-pointer hover:border-primary/50",
      )}
      onClick={onCardClick ? () => onCardClick(name) : undefined}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <PageTitle
          size={titleVariant}
          header={header}
          title={title}
          subtitle={description}
          icon={
            icon && (
              <span role="presentation" onClick={(event) => event.stopPropagation()}>
                {icon}
              </span>
            )
          }
        />
        {action && (
          <div
            role="presentation"
            className="relative z-10"
            onClick={(event) => event.stopPropagation()}
          >
            {action}
          </div>
        )}
      </CardHeader>
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
