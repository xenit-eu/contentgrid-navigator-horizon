import { UserIcon } from "@phosphor-icons/react";
import { StatusPill } from "@contentgrid/ui";

export interface ModifiedByAttributeRendererProps {
  readonly value: string | number | boolean | null;
  readonly label: string;
  readonly wrap?: boolean;
}

export function ModifiedByAttributeRenderer({
  value,
  label,
  wrap,
}: Readonly<ModifiedByAttributeRendererProps>) {
  const displayValue = value == null ? "—" : String(value);

  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={`${label}: ${displayValue}`}
      className={wrap ? "text-xs whitespace-normal break-words" : "text-xs"}
    />
  );
}
