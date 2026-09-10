import { CheckCircleIcon, MinusCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { StatusPill } from "@contentgrid/ui";

export interface BooleanAttributeRendererProps {
  readonly value: boolean | null;
  readonly label: string;
}

export function BooleanAttributeRenderer({
  value,
  label,
}: Readonly<BooleanAttributeRendererProps>) {
  if (value === true) {
    return (
      <StatusPill status="success" icon={<CheckCircleIcon size={14} aria-hidden />} label={label} />
    );
  }
  if (value === false) {
    return (
      <StatusPill status="neutral" icon={<XCircleIcon size={14} aria-hidden />} label={label} />
    );
  }
  return (
    <StatusPill status="neutral" icon={<MinusCircleIcon size={14} aria-hidden />} label={label} />
  );
}
