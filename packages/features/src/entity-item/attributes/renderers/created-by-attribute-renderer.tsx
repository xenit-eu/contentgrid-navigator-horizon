import { UserIcon } from "@phosphor-icons/react";
import { StatusPill } from "@contentgrid/ui";

export interface CreatedByAttributeRendererProps {
  readonly value: string | number | boolean | null;
  readonly label: string;
}

export function CreatedByAttributeRenderer({
  value,
  label,
}: Readonly<CreatedByAttributeRendererProps>) {
  const displayValue = value == null ? "—" : String(value);
  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={`${label}: ${displayValue}`}
    />
  );
}
