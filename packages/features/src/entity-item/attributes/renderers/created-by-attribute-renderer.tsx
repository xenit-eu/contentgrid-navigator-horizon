import { UserIcon } from "@phosphor-icons/react";
import { StatusPill } from "@contentgrid/ui";

export interface CreatedByAttributeRendererProps {
  readonly value: string | number | boolean | null;
}

export function CreatedByAttributeRenderer({ value }: Readonly<CreatedByAttributeRendererProps>) {
  const label = value == null ? "—" : String(value);
  return <StatusPill status="neutral" icon={<UserIcon size={14} aria-hidden />} label={label} />;
}
