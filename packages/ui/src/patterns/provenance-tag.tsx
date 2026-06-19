import { PencilSimpleIcon as PencilSimple, SparkleIcon as Sparkle } from "@phosphor-icons/react";
import { cn } from "../lib/utils";

interface ProvenanceTagProps {
  kind?: "extracted" | "modified";
  label?: string;
  className?: string;
}

function ProvenanceTag({ kind = "extracted", label, className }: ProvenanceTagProps) {
  if (kind === "extracted") {
    const displayLabel = label ?? "Extracted";
    return (
      <span
        data-slot="provenance-tag"
        className={cn(
          "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#064C79] dark:text-[#7CCDF4]",
          className,
        )}
      >
        <Sparkle size={14} className="text-[#019BE3] dark:text-[#5AC4F2]" aria-hidden />
        {displayLabel}
      </span>
    );
  }

  const displayLabel = label ?? "Modified";
  return (
    <span
      data-slot="provenance-tag"
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-[#7A3D14] dark:text-[#E89A63]",
        className,
      )}
    >
      <PencilSimple size={14} className="text-[#D4682A] dark:text-[#E89A63]" aria-hidden />
      {displayLabel}
    </span>
  );
}

export { ProvenanceTag };
