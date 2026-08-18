import * as React from "react";
import { cn } from "../lib/utils";

interface PageTitleProps extends React.ComponentProps<"div"> {
  readonly header: string;
  readonly title: string;
  readonly subtitle: string;
}

function PageTitle({ header, title, subtitle, className, ...props }: PageTitleProps) {
  return (
    <div data-slot="page-title" className={cn("space-y-1", className)} {...props}>
      <p
        data-slot="page-title-header"
        className="text-sm font-medium uppercase tracking-wide text-sky-700 dark:text-blue-300"
      >
        {header}
      </p>
      <h1 data-slot="page-title-title" className="text-3xl font-bold tracking-tight">
        {title}
      </h1>
      <p data-slot="page-title-subtitle" className="text-sm font-normal text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}

export { PageTitle };
export type { PageTitleProps };
