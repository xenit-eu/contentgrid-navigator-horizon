import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { AuditUserAttributeRenderer } from "./audit-user-attribute-renderer";
import type { AttributeRendererVariant } from "./variant";

export interface CreatedByAttributeRendererProps {
  readonly value: PlainAttributeValue;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
}

export function CreatedByAttributeRenderer(props: Readonly<CreatedByAttributeRendererProps>) {
  return <AuditUserAttributeRenderer {...props} />;
}
