import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@contentgrid/ui";

export interface GraphTrailBreadcrumbEntry {
  readonly id: string;
  readonly label: string;
  /** Title of the relation this entry was reached through (absent for the root). */
  readonly viaTitle?: string;
}

export interface GraphTrailBreadcrumbProps {
  readonly entries: readonly GraphTrailBreadcrumbEntry[];
  /** Return to the trail entry at `index` (FR-014). */
  readonly onReturn: (index: number) => void;
}

/**
 * The path of explored items from the root to the current focus. Every earlier entry is a
 * one-click way back; the relation walked between two entries is shown as the separator caption.
 */
export function GraphTrailBreadcrumb({ entries, onReturn }: Readonly<GraphTrailBreadcrumbProps>) {
  return (
    <Breadcrumb aria-label="Explored path">
      <BreadcrumbList>
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          return (
            <Fragment key={entry.id}>
              {index > 0 ? (
                <BreadcrumbSeparator>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span aria-hidden>›</span>
                    {entry.viaTitle ? <span className="italic">{entry.viaTitle}</span> : null}
                    <span aria-hidden>›</span>
                  </span>
                </BreadcrumbSeparator>
              ) : null}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="max-w-48 truncate" title={entry.label}>
                    {entry.label}
                  </BreadcrumbPage>
                ) : (
                  <button
                    type="button"
                    className="max-w-40 truncate rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title={entry.label}
                    onClick={() => onReturn(index)}
                  >
                    {entry.label}
                  </button>
                )}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
