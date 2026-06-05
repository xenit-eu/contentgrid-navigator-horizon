import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { EntitySchema } from "../types/entity";
import { findNameAttribute } from "../utils/entity-display-name";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { fetchEntityList } from "./use-entity-list";
import { fetchEntitySchema } from "./use-entity-schema";
import { useProfile } from "./use-profile";

export interface RecentlyCreatedItem {
  entityName: string;
  entityTitle: string;
  itemId: string;
  displayName: string;
  createdDate?: string;
  createdBy?: string;
}

export function useRecentlyCreated() {
  const { apiFetch } = useNavigatorData();
  const { data: entities } = useProfile();
  const entityList = useMemo(() => entities ?? [], [entities]);

  const schemaQueries = useQueries({
    queries: entityList.map((entity) => ({
      queryKey: queryKeys.entitySchema(entity.name),
      queryFn: () => fetchEntitySchema(apiFetch, entity.href),
      staleTime: Infinity,
    })),
  });

  const allEntities = useMemo(() => {
    return entityList
      .map((entity, i) => {
        const schema = schemaQueries[i]?.data as EntitySchema | undefined;
        if (!schema) return null;
        const auditAttr = schema.attributes.find((a) => a.type === "audit_metadata");
        let sortField: string | undefined;
        if (auditAttr) {
          sortField =
            schema.sortableFields.find((f) => f.includes("last_modified_date")) ??
            schema.sortableFields[0];
        } else {
          sortField = schema.sortableFields[0];
        }
        return { entity, auditAttrName: auditAttr?.name, sortField, schema };
      })
      .filter(Boolean) as Array<{
      entity: { name: string; title: string; collectionHref: string };
      auditAttrName: string | undefined;
      sortField: string | undefined;
      schema: EntitySchema;
    }>;
  }, [entityList, schemaQueries]);

  const createdQueries = useQueries({
    queries: allEntities.map(({ entity, sortField }) => ({
      queryKey: queryKeys.entityList(entity.name, {
        size: 10,
        ...(sortField ? { sort: `${sortField},desc` } : {}),
      }),
      queryFn: () =>
        fetchEntityList(apiFetch, entity.collectionHref, {
          size: 10,
          ...(sortField ? { sort: `${sortField},desc` } : {}),
        }),
    })),
  });

  const items: RecentlyCreatedItem[] = useMemo(() => {
    const withDate: RecentlyCreatedItem[] = [];
    const withoutDate: RecentlyCreatedItem[] = [];

    allEntities.forEach(({ entity, auditAttrName, schema }, i) => {
      const data = createdQueries[i]?.data;
      if (!data) return;

      const nameAttr = findNameAttribute(schema.attributes);

      data.items.forEach((item) => {
        const auditData = auditAttrName
          ? (item.data[auditAttrName] as { created_date?: string; created_by?: string } | undefined)
          : undefined;

        const createdDate = auditData?.created_date;
        const nameVal = nameAttr ? item.data[nameAttr.name] : undefined;
        const displayName = typeof nameVal === "string" && nameVal ? nameVal : item.id;
        const entry: RecentlyCreatedItem = {
          entityName: entity.name,
          entityTitle: entity.title,
          itemId: item.id,
          displayName,
          createdDate,
          createdBy: auditData?.created_by,
        };

        if (createdDate) withDate.push(entry);
        else withoutDate.push(entry);
      });
    });

    withDate.sort(
      (a, b) => new Date(b.createdDate!).getTime() - new Date(a.createdDate!).getTime(),
    );
    return [...withDate, ...withoutDate];
  }, [allEntities, createdQueries]);

  const schemasLoaded = schemaQueries.every((q) => !q.isLoading);
  return {
    items,
    isLoading: !schemasLoaded || createdQueries.some((q) => q.isLoading),
    hasEntities: schemasLoaded && allEntities.length > 0,
  };
}
