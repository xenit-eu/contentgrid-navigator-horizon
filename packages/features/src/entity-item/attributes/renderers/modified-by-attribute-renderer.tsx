import type { PlainAttributeValue } from "@contentgrid/navigator-data";
import { AuditUserAttributeRenderer } from "./audit-user-attribute-renderer";
import type { AttributeRendererVariant } from "./variant";

export interface ModifiedByAttributeRendererProps {
  readonly value: PlainAttributeValue;
  readonly label: string;
  readonly wrap?: boolean;
  readonly variant?: AttributeRendererVariant;
}

export function ModifiedByAttributeRenderer(props: Readonly<ModifiedByAttributeRendererProps>) {
  return <AuditUserAttributeRenderer {...props} pillClassName="text-xs" />;
}
