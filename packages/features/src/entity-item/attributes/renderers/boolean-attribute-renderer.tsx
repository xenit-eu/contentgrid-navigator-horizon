import { CheckCircleIcon, MinusCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { AttributeValue, StatusPill } from "@contentgrid/ui";
import { type AttributeRendererVariant, isTableVariant } from "./variant";

export interface BooleanAttributeRendererProps {
  readonly value: boolean | null;
  readonly label: string;
  readonly variant?: AttributeRendererVariant;
}

export function BooleanAttributeRenderer({
  value,
  label,
  variant = "default",
}: Readonly<BooleanAttributeRendererProps>) {
  if (isTableVariant(variant)) {
    return (
      <AttributeValue>
        {value === true ? "True" : value === false ? "False" : undefined}
      </AttributeValue>
    );
  }

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
