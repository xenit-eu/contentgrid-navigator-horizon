import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";
import { AttributeValueRenderer } from "../attributes/renderers/attribute-value-renderer";

const SUMMARY_ATTRIBUTE_COUNT = 4;

interface EntityItemAttributeSummaryProps {
  readonly item: EntityItem;
}

/** The item's first few user-defined (non-nested) attributes as a two-column label/value grid. */
export function EntityItemAttributeSummary({ item }: Readonly<EntityItemAttributeSummaryProps>) {
  return (
    <dl className="grid grid-cols-2 gap-2">
      {item.userDefinedAttributes
        .filter((attr) => attr.value.kind !== AttributeKind.NESTED)
        .slice(0, SUMMARY_ATTRIBUTE_COUNT)
        .map((attr) => (
          <div key={attr.value.name}>
            <dt className="text-xs text-muted-foreground">
              {attr.profileAttribute?.title ?? attr.value.name}
            </dt>
            <dd className="text-sm truncate">
              <AttributeValueRenderer attr={attr} />
            </dd>
          </div>
        ))}
    </dl>
  );
}
