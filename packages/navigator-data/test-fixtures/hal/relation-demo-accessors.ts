import { HalObject, HalSlice, type Link } from "@contentgrid/hal";
import { EntityItem } from "../../src/accessors/entity-item";
import { EntityItemCollection } from "../../src/accessors/entity-item-collection";
import ProfileEntity from "../../src/accessors/entity-profile";
import type { EntityItemShape, ProfileEntityShape } from "../../src/shapes";
import { RELATION_DEMO_ENTITIES, createRelationDemoModel } from "../msw/relation-demo-handlers";

/**
 * Synchronous accessor instances (`ProfileEntity`, `EntityItem`, `EntityItemCollection`) built
 * from the relation demo model (`../msw/relation-demo-handlers.ts`) — no HTTP. For pure unit
 * tests of code that consumes accessors (e.g. the entity-graph model builder in
 * `packages/features`), which cannot import `@contentgrid/hal` to build them itself.
 */
export function createRelationDemoAccessors(baseUrl = "https://api.example.com") {
  const model = createRelationDemoModel(baseUrl);

  const profiles: readonly ProfileEntity[] = RELATION_DEMO_ENTITIES.map((entity) => {
    const link = {
      href: model.profileUrl(entity),
      name: entity.name,
      title: entity.title,
    } as unknown as Link;
    return new ProfileEntity(
      link,
      new HalObject(model.profileBody(entity) as unknown as ProfileEntityShape),
    );
  });

  const profile = (entityName: string): ProfileEntity => {
    const found = profiles.find((p) => p.name === entityName);
    if (!found) throw new Error(`No demo profile "${entityName}"`);
    return found;
  };

  const demoItem = (id: string) => {
    const item = model.store.get(id);
    if (!item) throw new Error(`No demo item "${id}"`);
    return item;
  };

  /** The item with the given id, as an `EntityItem` with a `"v<version>"` etag. */
  const item = (id: string): EntityItem => {
    const raw = demoItem(id);
    return new EntityItem(
      new HalObject(model.itemBody(raw) as unknown as EntityItemShape),
      profile(raw.entity),
      `"v${raw.version}"`,
    );
  };

  /** The to-one target of `ownerId.relationName`, or `null` when the slot is empty. */
  const toOneTarget = (ownerId: string, relationName: string): EntityItem | null => {
    const [first] = model.relationTargets(demoItem(ownerId), relationName);
    return first ? item(first.id) : null;
  };

  /** One page (default: the first) of `ownerId.relationName`'s targets. */
  const toManyPage = (ownerId: string, relationName: string, cursor = 0): EntityItemCollection => {
    const owner = demoItem(ownerId);
    const entity = model.entityByName.get(owner.entity)!;
    const rel = entity.relations.find((r) => r.name === relationName);
    if (!rel) throw new Error(`No relation "${relationName}" on ${owner.entity}`);
    const body = model.pageBody(
      `${model.itemUrl(owner)}/${relationName}`,
      model.relationTargets(owner, relationName),
      owner.estimated.includes(relationName),
      cursor,
    );
    return new EntityItemCollection(
      new HalSlice(body as never) as HalSlice<EntityItemShape>,
      profile(rel.target),
    );
  };

  return { model, profiles, profile, item, toOneTarget, toManyPage };
}

export type RelationDemoAccessors = ReturnType<typeof createRelationDemoAccessors>;
