import { CheckCircleIcon, MinusCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { AttributeValue, StatusPill } from "@contentgrid/ui";
import { type AttributeRendererVariant, isTableVariant } from "./variant";

export interface BooleanAttributeRendererProps {
  readonly value: boolean | null;
  readonly label: string;
  readonly variant?: AttributeRendererVariant;
}

/** The design's compact 22px pill. */
const TABLE_PILL = "h-[22px] px-[9px] py-0";

export function BooleanAttributeRenderer({
  value,
  label,
  variant = "default",
}: Readonly<BooleanAttributeRendererProps>) {
  // The collection page's column shows a pill per state, with no icon; every other table keeps
  // the value as plain text.
  if (variant === "collection-table") {
    if (value === true)
      return <StatusPill status="success" label="True" icon={false} className={TABLE_PILL} />;
    if (value === false)
      return <StatusPill status="danger" label="False" icon={false} className={TABLE_PILL} />;
    return <StatusPill status="neutral" label="Not set" icon={false} className={TABLE_PILL} />;
  }

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
