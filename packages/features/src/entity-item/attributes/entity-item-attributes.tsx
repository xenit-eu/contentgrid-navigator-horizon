import { AttributeKind, type EntityItem, type ProfileEntity } from "@contentgrid/navigator-data";
import { AttributeCell } from "./renderers/attribute-cell";

export interface EntityItemAttributesProps {
  readonly profile: ProfileEntity;
  readonly item: EntityItem;
}

/**
 * Renders an entity item's user-defined attributes as a label/value grid.
 * Purely presentational: it reads the resolved `EntityItem` accessor and
 * renders it — it fetches nothing itself.
 */
export function EntityItemAttributes({ profile, item }: Readonly<EntityItemAttributesProps>) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {item.userDefinedAttributes
        .filter((attr) => attr.value.kind !== AttributeKind.NESTED)
        .map((attr) => {
          const label =
            profile.attributes.find((a) => a.name === attr.value.name)?.title ?? attr.value.name;
          return <AttributeCell key={attr.value.name} attr={attr} label={label} />;
        })}
    </dl>
  );
}
