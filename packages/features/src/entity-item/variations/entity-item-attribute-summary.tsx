import { AttributeKind, type EntityItem } from "@contentgrid/navigator-data";
import { AttributeValueRenderer } from "../attributes/renderers/attribute-value-renderer";

const DEFAULT_SUMMARY_ATTRIBUTE_COUNT = 4;

const GRID_COLUMNS_CLASS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
} as const;

interface EntityItemAttributeSummaryProps {
  readonly item: EntityItem;
  /** How many attributes to show at most. Defaults to 4. */
  readonly count?: number;
  /** Grid columns. Defaults to 2. */
  readonly columns?: keyof typeof GRID_COLUMNS_CLASS;
  /** Attribute names to leave out, e.g. ones already shown elsewhere (an item reference's title). */
  readonly excludeAttributeNames?: readonly string[];
  readonly className?: string;
}

/** The item's first few user-defined (non-nested) attributes as a label/value grid. */
export function EntityItemAttributeSummary({
  item,
  count = DEFAULT_SUMMARY_ATTRIBUTE_COUNT,
  columns = 2,
  excludeAttributeNames = [],
  className,
}: Readonly<EntityItemAttributeSummaryProps>) {
  return (
    <dl
      className={["grid gap-2", GRID_COLUMNS_CLASS[columns], className].filter(Boolean).join(" ")}
    >
      {item.userDefinedAttributes
        .filter(
          (attr) =>
            attr.value.kind !== AttributeKind.NESTED &&
            !excludeAttributeNames.includes(attr.value.name),
        )
        .slice(0, count)
        .map((attr) => (
          <div key={attr.value.name} className="min-w-0">
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
