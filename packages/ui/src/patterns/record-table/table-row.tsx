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
        "relative grid items-center gap-3 px-4 py-3 border-b border-[#F1F4F7] dark:border-[#1B3A50] cursor-pointer transition-colors",
        selected
          ? "bg-[#EAF6FE] dark:bg-[rgba(90,196,242,0.12)]"
          : "bg-[#FAFDFF] dark:bg-[#102a3e]",
        className,
      )}
    >
      {selected && (
        <span
          className="absolute left-0 top-0 h-full w-[3px] bg-[#019BE3] dark:bg-[#5AC4F2] rounded-r-sm"
          aria-hidden
        />
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
        <div role="cell" className="flex items-center justify-end gap-1">
          {actions}
        </div>
      )}
    </div>
  );
}

export { RecordTableRow };
