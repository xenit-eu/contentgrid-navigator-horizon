import { PenIcon } from "@phosphor-icons/react";
import type { ProfileAttributeType } from "@contentgrid/navigator-data";
import { AuditDateAttributeRenderer } from "./audit-date-attribute-renderer";
import type { AttributeRendererVariant } from "./variant";

export interface ModifiedDateAttributeRendererProps {
  readonly value: string | null;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
  readonly type?: ProfileAttributeType.date | ProfileAttributeType.datetime;
}

export function ModifiedDateAttributeRenderer(props: Readonly<ModifiedDateAttributeRendererProps>) {
  return <AuditDateAttributeRenderer {...props} icon={PenIcon} />;
}
