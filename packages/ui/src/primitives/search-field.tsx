import { MagnifyingGlassIcon as MagnifyingGlass, XIcon as X } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface SearchFieldProps {
  readonly focused?: boolean;
  readonly placeholder?: string;
  readonly chips?: ReadonlyArray<{ readonly field: string; readonly label: string }>;
  readonly onRemoveChip?: (index: number) => void;
  readonly onChange?: (value: string) => void;
  readonly value?: string;
  readonly className?: string;
}

function SearchField({
  focused,
  placeholder = "Search…",
  chips,
  onRemoveChip,
  onChange,
  value,
  className,
}: SearchFieldProps) {
  return (
    <div
      data-slot="search-field"
      className={cn(
        "flex flex-wrap items-center gap-2 px-[14px] py-2 rounded-[9px] border bg-[#FAFDFF] dark:bg-[#0E2738] border-border dark:border-[#335269]",
        focused && "border-[#019BE3] dark:border-[#5AC4F2] ring-[3px] ring-ring/30",
        className,
      )}
    >
      <MagnifyingGlass size={16} className="text-muted-foreground flex-shrink-0" aria-hidden />

      {chips?.map((chip, index) => (
        <span
          key={`${chip.field}:${chip.label}`}
          className="inline-flex items-center gap-1 rounded-[6px] border bg-[#FAFDFF] dark:bg-[#13314A] border-border dark:border-[#335269] px-[9px] py-[3px] text-[12px]"
        >
          <span className="text-muted-foreground font-normal mr-0.5">{chip.field}:</span>
          <span className="text-foreground font-medium">{chip.label}</span>
          {onRemoveChip && (
            <button
              type="button"
              onClick={() => onRemoveChip(index)}
              aria-label={`Remove ${chip.label} filter`}
              className="ml-1 text-muted-foreground hover:text-foreground cursor-pointer p-0 border-0 bg-transparent flex items-center"
            >
              <X size={11} aria-hidden />
            </button>
          )}
        </span>
      ))}

      <input
        type="search"
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={chips?.length ? undefined : placeholder}
        aria-label={placeholder ?? "Search"}
        className="flex-1 min-w-[90px] text-[13px] bg-transparent outline-none border-0 text-foreground placeholder:text-muted-foreground"
      />
    </div>
  );
}

export { SearchField };
