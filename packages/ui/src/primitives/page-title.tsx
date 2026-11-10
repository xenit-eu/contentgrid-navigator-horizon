import * as React from "react";
import { cn } from "../lib/utils";

interface PageTitleProps extends React.ComponentProps<"div"> {
  readonly header?: string;
  readonly title: string;
  readonly subtitle?: string;
  /** Rendered left of the title, same height as the title text — typically an `IconBadge`. */
  readonly icon?: React.ReactNode;
  /** Denser sizing for use inside a card or panel rather than as a full page title. */
  readonly size?: "default" | "compact";
  /** Renders `subtitle` beneath the title, to the right of `icon`, instead of as a
   * full-width block beneath the whole heading row. */
  readonly indentSubtitle?: boolean;
  /** Renders the title in its size's bold weight. When false, the title uses a normal
   * font weight instead. Defaults to true. */
  readonly boldTitle?: boolean;
  /** Clamps the title to one line and the subtitle to two, reserving two subtitle lines
   * even when there is none, so the block has a fixed height. Clamped text gets a native
   * `title` tooltip with the full text. Defaults to false. */
  readonly clamp?: boolean;
}

function PageTitle({
  header,
  title,
  subtitle,
  icon,
  size = "default",
  indentSubtitle = false,
  boldTitle = true,
  clamp = false,
  className,
  ...props
}: Readonly<PageTitleProps>) {
  const compact = size === "compact";
  const Title = compact ? "h2" : "h1";

  const titleElement = (
    <Title
      data-slot="page-title-title"
      title={clamp ? title : undefined}
      className={cn(
        "tracking-tight",
        clamp && "line-clamp-1",
        compact ? "text-lg" : "text-3xl",
        boldTitle ? (compact ? "font-semibold" : "font-bold") : "font-normal",
      )}
    >
      {title}
    </Title>
  );

  const subtitleElement = (subtitle || clamp) && (
    <p
      data-slot="page-title-subtitle"
      title={clamp ? subtitle : undefined}
      className={cn(
        "font-normal text-muted-foreground",
        compact ? "text-xs" : "text-sm",
        clamp && "line-clamp-2 min-h-[2lh]",
      )}
    >
      {subtitle}
    </p>
  );

  return (
    <div
      data-slot="page-title"
      data-size={size}
      className={cn(compact ? "space-y-0.5" : "space-y-1", className)}
      {...props}
    >
      {header && (
        <p
          data-slot="page-title-header"
          className={cn(
            "font-medium uppercase tracking-wide text-sky-700 dark:text-blue-300",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {header}
        </p>
      )}
      <div
        data-slot="page-title-heading"
        className={cn(
          "flex",
          indentSubtitle ? "items-start" : "items-center",
          compact ? "gap-2" : "gap-3",
        )}
      >
        {icon}
        {indentSubtitle ? (
          <div className="min-w-0">
            {titleElement}
            {subtitleElement}
          </div>
        ) : (
          titleElement
        )}
      </div>
      {!indentSubtitle && subtitleElement}
    </div>
  );
}

export { PageTitle };
export type { PageTitleProps };
