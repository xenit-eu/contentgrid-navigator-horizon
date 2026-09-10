import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { getRecordTableGridTemplate } from "./grid-template";

export interface RecordTableCell {
  readonly key: string;
  readonly content: ReactNode;
  readonly align?: "start" | "end";
}

export interface RecordTableRowProps {
  readonly cells: readonly RecordTableCell[];
  readonly actions?: ReactNode;
  readonly selected?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
}

function RecordTableRow({
  cells,
  actions,
  selected = false,
  onClick,
  className,
}: RecordTableRowProps) {
  // `--accent` is already the shadcn convention for a "selected"/highlighted row (see
  // ItemReference's `selected && "bg-accent"`) — light mode's accent is a pre-softened pastel so
  // it's used at full opacity, but dark mode's accent is a saturated highlight color, so it's
  // dialed down to a wash via opacity rather than painting the whole row solid blue.
  const rowBackground = selected ? "bg-accent dark:bg-accent/15" : "bg-card/50";

  return (
    <div
      role="row"
      data-slot="table-row"
      onClick={onClick}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") {
                onClick();
              } else if (e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        gridTemplateColumns: getRecordTableGridTemplate(cells.length, {
          hasActions: Boolean(actions),
        }),
      }}
      className={cn(
        // `w-fit min-w-full`: a block-level grid container's `width: auto` fills the scroll
        // parent's available width and stops there — it does NOT grow to accommodate its own
        // overflowing tracks, so the row's painted background/border stay at the container's
        // width while the (unclipped) grid content spills out past it. `w-fit` lets the row grow
        // to its content's actual width when that's wider than the container (matching what the
        // rowgroup ends up scrolling to); `min-w-full` keeps it at 100% when content is narrower.
        "relative grid w-fit min-w-full items-center gap-3 px-4 py-3 border-b border-border cursor-pointer transition-colors",
        rowBackground,
        className,
      )}
    >
      {selected && (
        <span className="absolute left-0 top-0 h-full w-[3px] bg-ring rounded-r-sm" aria-hidden />
      )}

      {cells.map((cell) => (
        <div
          key={cell.key}
          role="cell"
          className={cn(
            "text-[13px] text-foreground truncate",
            cell.align === "end" && "text-right tabular-nums",
          )}
        >
          {cell.content}
        </div>
      ))}

      {actions && (
        <div
          role="cell"
          className={cn("sticky right-0 flex items-center justify-end gap-1", rowBackground)}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export { RecordTableRow };
