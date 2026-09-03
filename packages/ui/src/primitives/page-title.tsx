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
}

function PageTitle({
  header,
  title,
  subtitle,
  icon,
  size = "default",
  indentSubtitle = false,
  className,
  ...props
}: Readonly<PageTitleProps>) {
  const compact = size === "compact";
  const Title = compact ? "h2" : "h1";

  const titleElement = (
    <Title
      data-slot="page-title-title"
      className={cn("tracking-tight", compact ? "text-lg font-semibold" : "text-3xl font-bold")}
    >
      {title}
    </Title>
  );

  const subtitleElement = subtitle && (
    <p
      data-slot="page-title-subtitle"
      className={cn("font-normal text-muted-foreground", compact ? "text-xs" : "text-sm")}
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
          <div>
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
