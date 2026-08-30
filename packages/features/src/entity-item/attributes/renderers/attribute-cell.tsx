import {
  AttributeKind,
  type EntityItemAttribute,
  ProfileAttributeType,
} from "@contentgrid/navigator-data";
import { AttributeValueRenderer } from "./attribute-value-renderer";
import { useAttributeRendererComponents } from "./registry";

export interface AttributeCellProps {
  readonly attr: EntityItemAttribute;
  readonly label: string;
}

/**
 * Renders one full attribute grid cell for the main entity-detail view. Boolean
 * attributes collapse into a single self-labeled chip (no separate `<dt>`); every
 * other type keeps the `<dt>`/`<dd>` label+value pair around `AttributeValueRenderer`.
 */
export function AttributeCell({ attr, label }: Readonly<AttributeCellProps>) {
  const components = useAttributeRendererComponents();

  if (
    attr.value.kind === AttributeKind.PLAIN &&
    attr.profileAttribute?.type === ProfileAttributeType.boolean
  ) {
    return (
      <div className="rounded-lg border p-4 flex items-center">
        <components.boolean value={attr.value.value as boolean | null} label={label} />
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <AttributeValueRenderer attr={attr} />
      </dd>
    </div>
  );
}
