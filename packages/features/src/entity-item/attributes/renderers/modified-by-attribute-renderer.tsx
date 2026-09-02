import { UserIcon } from "@phosphor-icons/react";
import { StatusPill } from "@contentgrid/ui";

export interface ModifiedByAttributeRendererProps {
  readonly value: string | number | boolean | null;
  readonly label: string;
}

export function ModifiedByAttributeRenderer({
  value,
  label,
}: Readonly<ModifiedByAttributeRendererProps>) {
  const displayValue = value == null ? "—" : String(value);

  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={`${label}: ${displayValue}`}
      className="text-xs whitespace-normal break-words"
    />
  );
}
