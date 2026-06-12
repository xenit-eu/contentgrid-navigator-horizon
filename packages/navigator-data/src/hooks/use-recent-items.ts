import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { AuditRoles, EntitySchema } from "../types/entity";
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
        const auditRoles = auditAttr?.auditRoles;
        let sortField: string | undefined;
        if (auditAttr) {
          // Prefer sorting by the modified-date role if available; fall back to
          // any known sortable field.  We search sortableFields by the discovered
          // modified-date sub-attribute name (not a hardcoded string).
          const modifiedDateField = auditRoles?.["modified-date"];
          sortField =
            (modifiedDateField
              ? schema.sortableFields.find((f) => f.includes(modifiedDateField))
              : undefined) ?? schema.sortableFields[0];
        } else {
          sortField = schema.sortableFields[0];
        }
        return { entity, auditAttrName: auditAttr?.name, auditRoles, sortField, schema };
      })
      .filter(Boolean) as Array<{
      entity: { name: string; title: string; collectionHref: string };
      auditAttrName: string | undefined;
      auditRoles: AuditRoles | undefined;
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

    allEntities.forEach(({ entity, auditAttrName, auditRoles, schema }, i) => {
      const data = createdQueries[i]?.data;
      if (!data) return;

      const nameAttr = findNameAttribute(schema.attributes);

      data.items.forEach((item) => {
        // Read the audit object from entity data using the discovered attribute name.
        const auditData =
          auditAttrName == null
            ? undefined
            : (item.data[auditAttrName] as Record<string, unknown> | undefined);

        // Use the profile-discovered sub-attribute names rather than hardcoded
        // literals (e.g. "created_date", "created_by").  auditRoles is the
        // canonical source; gracefully absent when no audit attribute exists.
        const createdDateField = auditRoles?.["created-date"];
        const createdByField = auditRoles?.["created-by"];
        const createdDate =
          createdDateField == null
            ? undefined
            : (auditData?.[createdDateField] as string | undefined);
        const nameVal = nameAttr ? item.data[nameAttr.name] : undefined;
        const displayName = typeof nameVal === "string" && nameVal ? nameVal : item.id;
        const entry: RecentlyCreatedItem = {
          entityName: entity.name,
          entityTitle: entity.title,
          itemId: item.id,
          displayName,
          createdDate,
          createdBy:
            createdByField == null
              ? undefined
              : (auditData?.[createdByField] as string | undefined),
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
