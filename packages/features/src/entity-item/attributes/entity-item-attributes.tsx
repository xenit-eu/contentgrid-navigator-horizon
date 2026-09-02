import {
  AttributeKind,
  type EntityItem,
  type EntityItemAttribute,
  ProfileAttributeType,
  type ProfileEntity,
} from "@contentgrid/navigator-data";
import { AttributeValue, Table, TableBody, TableCell, TableRow } from "@contentgrid/ui";
import { AttributeValueRenderer } from "./renderers/attribute-value-renderer";
import { useAttributeValueRendererComponents } from "./renderers/registry";

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

function isDefined(attr: EntityItemAttribute | undefined): attr is EntityItemAttribute {
  return attr !== undefined;
}

function AuditTimelineEntry({
  attrs,
  isLast,
}: Readonly<{ attrs: readonly EntityItemAttribute[]; isLast: boolean }>) {
  return (
    <div className="relative flex gap-3 pb-3 last:pb-0">
      {!isLast && (
        <span
          className="absolute top-5.5 bottom-0 left-[2px] w-0.5 bg-muted-foreground/30"
          aria-hidden
        />
      )}
      <span className="mt-2 size-[7px] shrink-0 rounded-full bg-muted-foreground" aria-hidden />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground/80">
        {attrs.map((attr) => (
          <span key={attr.value.name} className="flex min-w-0 items-center gap-2">
            <AttributeValueRenderer attr={attr} wrap />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Renders an entity item's user-defined attributes: audit trail up top as a
 * two-entry timeline (created date + creator, then modified date +
 * modifier), boolean attributes as a row of chips below that, then a simple
 * label/value table for every attribute — booleans included, shown as plain
 * "true"/"false"/"unset" text there. Purely presentational: it reads the
 * resolved `EntityItem` accessor and renders it — it fetches nothing itself.
 */
export function EntityItemAttributes({ profile, item }: Readonly<EntityItemAttributesProps>) {
  const components = useAttributeValueRendererComponents();

  const attributes = item.userDefinedAttributes
    .filter((attr) => attr.value.kind !== AttributeKind.NESTED)
    .map((attr) => ({
      attr,
      label: profile.attributes.find((a) => a.name === attr.value.name)?.title ?? attr.value.name,
    }));

  const booleanAttributes = attributes.filter(({ attr }) => isBooleanAttribute(attr));
  const createdAttrs = [item.createdDate, item.createdBy].filter(isDefined);
  const modifiedAttrs = [item.modifiedDate, item.modifiedBy].filter(isDefined);
  const timelineEntries = [createdAttrs, modifiedAttrs].filter((attrs) => attrs.length > 0);

  return (
    <div className="space-y-4">
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
      {timelineEntries.length > 0 && (
        <div className="">
          {timelineEntries.map((attrs, index) => (
            <AuditTimelineEntry
              key={attrs[0].value.name}
              attrs={attrs}
              isLast={index === timelineEntries.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
