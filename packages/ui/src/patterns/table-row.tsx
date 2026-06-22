import { cn } from "../lib/utils";
import { FileIcon } from "../primitives/file-icon";

interface TableRowProps {
  readonly selected?: boolean;
  readonly fileType?: "pdf" | "img" | "doc";
  readonly reference?: string;
  readonly fileMeta?: string;
  readonly supplier?: string;
  readonly total?: string;
  readonly onClick?: () => void;
  readonly className?: string;
}

function RecordTableRow({
  selected = false,
  fileType,
  reference,
  fileMeta,
  supplier,
  total,
  onClick,
  className,
}: TableRowProps) {
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
      className={cn(
        "relative grid grid-cols-[1.6fr_1fr_0.9fr] items-center gap-3 px-4 py-3 border-b border-[#F1F4F7] dark:border-[#1B3A50] cursor-pointer transition-colors",
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

      <div role="cell" className="flex items-center gap-[11px]">
        <FileIcon type={fileType} size={30} />
        <div>
          <div className="text-[13px] font-medium text-foreground">{reference}</div>
          <div className="text-[12px] text-muted-foreground">{fileMeta}</div>
        </div>
      </div>

      <div role="cell" className="text-[13px] text-[#22384C] dark:text-[#C3D7E5] truncate">
        {supplier}
      </div>

      <div role="cell" className="text-[13px] font-medium text-foreground text-right tabular-nums">
        {total}
      </div>
    </div>
  );
}

export { RecordTableRow };
