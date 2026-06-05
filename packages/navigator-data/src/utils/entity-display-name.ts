import type { EntityAttribute } from "../types/entity";

function isTextLike(type: string): boolean {
  const t = type.toLowerCase();
  return t === "text" || t === "string";
}

function asString(val: unknown): string | undefined {
  return typeof val === "string" && val.length > 0 ? val : undefined;
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
    const val = asString(data[nameAttr.name]);
    if (val) return val;
  }
  const titleVal = asString(data.title);
  if (titleVal) return titleVal;
  const nameVal = asString(data.name);
  if (nameVal) return nameVal;
  for (const attr of attributes) {
    if (attr.name === "id" || !isTextLike(attr.type)) continue;
    const val = asString(data[attr.name]);
    if (val) return val;
  }
  return `${itemId.substring(0, 8)}...`;
}
