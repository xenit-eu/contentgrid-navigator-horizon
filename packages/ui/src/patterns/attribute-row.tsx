import { cn } from "../lib/utils";

interface AttributeRowProps {
  readonly label: string;
  readonly value?: string;
  readonly empty?: boolean;
  readonly className?: string;
}

function AttributeRow({ label, value, empty, className }: AttributeRowProps) {
  const isEmpty = empty ?? !value;

  return (
    <div
      data-slot="attribute-row"
      className={cn(
        "grid grid-cols-2 gap-3 py-[11px] border-b border-[#F1F4F7] dark:border-[#1B3A50]",
        className,
      )}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={cn("text-[13px]", isEmpty ? "text-muted-foreground" : "text-foreground")}>
        {isEmpty ? "—" : value}
      </span>
    </div>
  );
}

export { AttributeRow };
