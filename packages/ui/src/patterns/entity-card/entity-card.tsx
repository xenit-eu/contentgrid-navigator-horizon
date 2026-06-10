import { PlusCircle } from "lucide-react";

export interface EntityCardProps {
  /** Unique identifier / URL-safe name for this entity (used in callback) */
  name: string;
  /** Human-readable title */
  title: string;
  /** Total item count; shown as "—" when undefined */
  count?: number;
  /** Optional description shown below the title */
  description?: string;
  /** When true a FileText icon is shown, otherwise a Database icon */
  hasContent?: boolean;
  /** Called when the user clicks the create-action button */
  onCreateClick?: (entityName: string) => void;
  /** Called when the user clicks the card title / entity link */
  onTitleClick?: (entityName: string) => void;
}

export function EntityCard({
  name,
  title,
  count,
  description,
  onCreateClick,
  onTitleClick,
}: Readonly<EntityCardProps>) {
  return (
    <div
      data-slot="entity-card"
      className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--cg-color-card-border)] bg-card p-4 shadow-[0_1px_2px_rgba(8,29,48,0.05)]"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="min-w-0">
          <button
            type="button"
            className="inline-block max-w-full truncate rounded-[2px] text-left text-[13px] font-semibold text-[var(--cg-color-midnight)] hover:text-primary hover:underline hover:underline-offset-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-[3px]"
            onClick={() => onTitleClick?.(name)}
          >
            {title}
          </button>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span>{count ?? "—"}</span> <span>items</span>
          </div>
          {description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <button
          type="button"
          title={`Create ${title}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={(e) => {
            e.stopPropagation();
            onCreateClick?.(name);
          }}
        >
          <PlusCircle className="size-[18px]" />
          <span className="sr-only">Create {title}</span>
        </button>
      </div>
    </div>
  );
}
