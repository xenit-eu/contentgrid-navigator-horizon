import type { EntityAttribute } from "../types/entity";

function isTextLike(type: string): boolean {
  const t = type.toLowerCase();
  return t === "text" || t === "string";
}

export function findNameAttribute(
  attributes: EntityAttribute[],
  configuredAttribute?: string | null,
): EntityAttribute | undefined {
  if (configuredAttribute) {
    const found = attributes.find((a) => a.name === configuredAttribute);
    if (found) return found;
  }
  return (
    attributes.find((a) => {
      const n = a.name.toLowerCase();
      return (n === "name" || n === "title") && isTextLike(a.type);
    }) ?? attributes.find((a) => isTextLike(a.type) && a.name !== "id")
  );
}

export function resolveDisplayName(
  data: Record<string, unknown>,
  itemId: string,
  attributes: EntityAttribute[],
  configuredAttribute?: string | null,
): string {
  const nameAttr = findNameAttribute(attributes, configuredAttribute);
  if (nameAttr) {
    const val = data[nameAttr.name];
    if (typeof val === "string" && val.length > 0) return val;
  }
  if (typeof data.title === "string" && data.title.length > 0) return data.title;
  if (typeof data.name === "string" && data.name.length > 0) return data.name;
  for (const attr of attributes) {
    if (attr.name === "id") continue;
    if (!isTextLike(attr.type)) continue;
    const val = data[attr.name];
    if (typeof val === "string" && val.length > 0) return val;
  }
  return `${itemId.substring(0, 8)}...`;
}
