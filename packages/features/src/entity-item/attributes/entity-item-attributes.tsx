import type { EntityItem, ProfileEntity } from "@contentgrid/navigator-data";
import { formatAttributeValue } from "./attribute-format";

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
      {item.userDefinedAttributes.map((attr) => {
        const label =
          profile.attributes.find((a) => a.name === attr.value.name)?.title ?? attr.value.name;
        return (
          <div key={attr.value.name} className="rounded-lg border p-4">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="mt-1 truncate text-sm">{formatAttributeValue(attr)}</dd>
          </div>
        );
      })}
    </dl>
  );
}
