import {
  AttributeKind,
  type EntityItem,
  type EntityItemAttribute,
  ProfileAttributeType,
  type ProfileEntity,
} from "@contentgrid/navigator-data";
import { AttributeValue, Table, TableBody, TableCell, TableRow } from "@contentgrid/ui";
import { AttributeValueRenderer } from "./renderers/attribute-value-renderer";
import { useAttributeRendererComponents } from "./renderers/registry";

export interface EntityItemAttributesProps {
  readonly profile: ProfileEntity;
  readonly item: EntityItem;
}

function isBooleanAttribute(attr: EntityItemAttribute): boolean {
  return (
    attr.value.kind === AttributeKind.PLAIN &&
    attr.profileAttribute?.type === ProfileAttributeType.boolean
  );
}

function formatBooleanTableValue(attr: EntityItemAttribute): string {
  if (attr.value.kind !== AttributeKind.PLAIN) {
    return "unset";
  }
  if (attr.value.value === true) {
    return "true";
  }
  if (attr.value.value === false) {
    return "false";
  }
  return "unset";
}

/**
 * Renders an entity item's user-defined attributes: audit trail (created/
 * modified) up top, boolean attributes as a row of chips below that, then a
 * simple label/value table for every attribute — booleans included, shown as
 * plain "true"/"false"/"unset" text there. Purely presentational: it reads
 * the resolved `EntityItem` accessor and renders it — it fetches nothing itself.
 */
export function EntityItemAttributes({ profile, item }: Readonly<EntityItemAttributesProps>) {
  const components = useAttributeRendererComponents();

  const attributes = item.userDefinedAttributes
    .filter((attr) => attr.value.kind !== AttributeKind.NESTED)
    .map((attr) => ({
      attr,
      label: profile.attributes.find((a) => a.name === attr.value.name)?.title ?? attr.value.name,
    }));

  const booleanAttributes = attributes.filter(({ attr }) => isBooleanAttribute(attr));
  const auditAttributes = item.auditAttributes.filter(
    (attr) => attr.value.kind !== AttributeKind.NESTED,
  );

  return (
    <div className="space-y-4">
      {auditAttributes.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
          {auditAttributes.map((attr, index) => (
            <span key={attr.value.name} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden>·</span>}
              <AttributeValueRenderer attr={attr} />
            </span>
          ))}
        </div>
      )}
      {booleanAttributes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {booleanAttributes.map(({ attr, label }) => (
            <components.boolean
              key={attr.value.name}
              value={
                attr.value.kind === AttributeKind.PLAIN
                  ? (attr.value.value as boolean | null)
                  : null
              }
              label={label}
            />
          ))}
        </div>
      )}
      {attributes.length > 0 && (
        <Table>
          <TableBody>
            {attributes.map(({ attr, label }) => (
              <TableRow key={attr.value.name}>
                <TableCell className="text-muted-foreground font-medium">{label}</TableCell>
                <TableCell className="w-full">
                  {isBooleanAttribute(attr) ? (
                    <AttributeValue>{formatBooleanTableValue(attr)}</AttributeValue>
                  ) : (
                    <AttributeValueRenderer attr={attr} />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
