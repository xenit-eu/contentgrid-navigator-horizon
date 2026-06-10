import { type LucideIcon, PlusCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityCardTint = "sky" | "ocean" | "breeze" | "sand" | "amber" | "steel";

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
  /**
   * Optional Lucide icon component to display in the icon tile.
   * When provided alongside `tint`, renders a 36×36 rounded tile on the left.
   */
  icon?: LucideIcon;
  /**
   * Tint variant for the icon tile.
   * Maps to `--cg-tint-<tint>-bg` (background) and `--cg-tint-<tint>-fg` (icon color).
   * Only takes effect when `icon` is also provided.
   */
  tint?: EntityCardTint;
  /** Called when the user clicks the create-action button */
  onCreateClick?: (entityName: string) => void;
  /** Called when the user clicks the card title / entity link */
  onTitleClick?: (entityName: string) => void;
}

// ---------------------------------------------------------------------------
// Tint → CSS variable map (avoids arbitrary value JIT purging)
// ---------------------------------------------------------------------------

const TINT_BG: Record<EntityCardTint, string> = {
  sky: "var(--cg-tint-sky-bg)",
  ocean: "var(--cg-tint-ocean-bg)",
  breeze: "var(--cg-tint-breeze-bg)",
  sand: "var(--cg-tint-sand-bg)",
  amber: "var(--cg-tint-amber-bg)",
  steel: "var(--cg-tint-steel-bg)",
};

const TINT_FG: Record<EntityCardTint, string> = {
  sky: "var(--cg-tint-sky-fg)",
  ocean: "var(--cg-tint-ocean-fg)",
  breeze: "var(--cg-tint-breeze-fg)",
  sand: "var(--cg-tint-sand-fg)",
  amber: "var(--cg-tint-amber-fg)",
  steel: "var(--cg-tint-steel-fg)",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityCard({
  name,
  title,
  count,
  description,
  icon: Icon,
  tint,
  onCreateClick,
  onTitleClick,
}: Readonly<EntityCardProps>) {
  return (
    <div
      data-slot="entity-card"
      className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--cg-color-card-border)] bg-card p-4 shadow-[0_1px_2px_rgba(8,29,48,0.05)] transition-[border-color,box-shadow] hover:border-[var(--cg-color-sky)] hover:shadow-[0_6px_18px_-8px_rgba(1,155,227,.35)]"
    >
      <div className="flex items-center justify-between gap-2.5">
        {/* Icon tile — only rendered when both icon and tint are supplied */}
        {Icon && tint && (
          <div
            className="grid size-9 shrink-0 place-items-center rounded-[9px]"
            style={{ background: TINT_BG[tint], color: TINT_FG[tint] }}
            aria-hidden
          >
            <Icon size={18} strokeWidth={1.8} />
          </div>
        )}

        {/* Title + count block */}
        <div className="min-w-0 flex-1">
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

        {/* Create (+) action */}
        <button
          type="button"
          title={`Create ${title}`}
          className="grid size-7 shrink-0 place-items-center rounded-md text-primary transition-colors hover:bg-[#E2F3FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
