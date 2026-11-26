import { CalendarIcon } from "@phosphor-icons/react";
import type { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AuditDateAttributeRenderer } from "./audit-date-attribute-renderer";
import type { AttributeRendererVariant } from "./variant";

export interface CreatedDateAttributeRendererProps {
  readonly value: string | null;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
  readonly type?: ProfileAttributeType.date | ProfileAttributeType.datetime;
}

export function CreatedDateAttributeRenderer(props: Readonly<CreatedDateAttributeRendererProps>) {
  return <AuditDateAttributeRenderer {...props} icon={CalendarIcon} />;
}
