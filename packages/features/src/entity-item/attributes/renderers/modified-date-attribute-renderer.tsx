import { PenIcon } from "@phosphor-icons/react";
import { AttributeValue } from "@contentgrid/ui";
import { formatRelativeOrAbsoluteDate } from "./format-relative-date";

export interface ModifiedDateAttributeRendererProps {
  readonly value: string | null;
  readonly label: string;
}

export function ModifiedDateAttributeRenderer({
  value,
  label,
}: Readonly<ModifiedDateAttributeRendererProps>) {
  if (value == null) {
    return <AttributeValue />;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return <AttributeValue>{value}</AttributeValue>;
  }

  return (
    <span className="flex items-center gap-1.5">
      <PenIcon size={14} className="text-muted-foreground" aria-hidden />
      <AttributeValue>{`${label}: ${formatRelativeOrAbsoluteDate(parsed)}`}</AttributeValue>
    </span>
  );
}
