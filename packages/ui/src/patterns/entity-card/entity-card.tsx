import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { PageTitle, type PageTitleProps } from "../../primitives";
import { Card, CardContent, CardHeader } from "../../primitives/card";

interface EntityCardBaseProps {
  /** Unique identifier / URL-safe name for this entity (passed to `onCardClick`) */
  name: string;
  /** Small eyebrow label rendered above the title. Omitted entirely when not provided. */
  header?: string;
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

  indentSubtitle?: boolean;
  /** Renders `children` edge to edge — no horizontal padding, no bottom gutter, and a tighter
   * header — e.g. for a list of full-width rows that should run to the card's border. */
  flushContent?: boolean;
}

export type EntityCardProps = EntityCardBaseProps &
  (
    | {
        /** Human-readable title */
        title: string;
        heading?: undefined;
      }
    | {
        /** Custom title block rendered in place of the default one (`header`, `title`,
         * `description`, `icon`) — e.g. an item reference with a summary below it. */
        heading: ReactNode;
        title?: undefined;
      }
  );

export function EntityCard({
  name,
  header,
  title,
  heading,
  description,
  icon,
  action,
  children,
  onCardClick,
  indentSubtitle = true,
  titleVariant = "compact",
  flushContent = false,
}: Readonly<EntityCardProps>) {
  return (
    <Card
      data-slot="entity-card"
      role={onCardClick ? "button" : undefined}
      tabIndex={onCardClick ? 0 : undefined}
      className={cn(
        "group relative transition-colors",
        onCardClick && "cursor-pointer hover:border-primary/50",
        flushContent && children && "gap-3 overflow-hidden pt-4 pb-0",
      )}
      onClick={onCardClick ? () => onCardClick(name) : undefined}
      onKeyDown={
        onCardClick
          ? (event) => {
              if (event.key === "Enter") {
                onCardClick(name);
              } else if (event.key === " ") {
                event.preventDefault();
                onCardClick(name);
              }
            }
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        {title !== undefined ? (
          <PageTitle
            size={titleVariant}
            header={header}
            title={title}
            subtitle={description}
            indentSubtitle={indentSubtitle}
            icon={
              icon && (
                <span role="presentation" onClick={(event) => event.stopPropagation()}>
                  {icon}
                </span>
              )
            }
          />
        ) : (
          <div className="min-w-0 flex-1">{heading}</div>
        )}
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
      {children && <CardContent className={cn(flushContent && "px-0")}>{children}</CardContent>}
    </Card>
  );
}
