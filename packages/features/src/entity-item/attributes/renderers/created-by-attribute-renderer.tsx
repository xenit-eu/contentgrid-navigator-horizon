import { UserIcon } from "@phosphor-icons/react";
import { StatusPill } from "@contentgrid/ui";

export interface CreatedByAttributeRendererProps {
  readonly value: string | number | boolean | null;
  readonly label: string;
  readonly wrap?: boolean;
}

export function CreatedByAttributeRenderer({
  value,
  label,
  wrap,
}: Readonly<CreatedByAttributeRendererProps>) {
  const displayValue = value == null ? "—" : String(value);
  return (
    <StatusPill
      status="neutral"
      icon={<UserIcon size={14} aria-hidden />}
      label={`${label}: ${displayValue}`}
      className={wrap ? "whitespace-normal break-words" : undefined}
    />
  );
}
