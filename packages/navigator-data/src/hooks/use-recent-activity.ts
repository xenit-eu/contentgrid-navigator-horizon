import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { EntitySchema } from "../types/entity";
import { findNameAttribute } from "../utils/entity-display-name";
import { convertToString } from "../utils/format";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { type EntityListResult, fetchEntityList } from "./use-entity-list";
import { fetchEntitySchema } from "./use-entity-schema";
import { useProfile } from "./use-profile";

export interface RecentActivityDetail {
  label: string;
  value: string;
}

function buildDetails(
  attrs: EntitySchema["attributes"],
  data: Record<string, unknown>,
): RecentActivityDetail[] {
  return attrs.slice(0, 3).flatMap((attr) => {
    const val = data[attr.name];
    if (val == null || val === "") return [];
    return [{ label: attr.title, value: convertToString(val) }];
  });
}

export interface RecentActivityItem {
  entityName: string;
  entityTitle: string;
  itemId: string;
  displayName: string;
  action: "created" | "modified";
  modifiedBy?: string;
  modifiedDate: string;
  details: RecentActivityDetail[];
}

function isDisplayableScalar(type: string): boolean {
  const t = type.toLowerCase();
  return [
    "text",
    "string",
    "decimal",
    "double",
    "number",
    "integer",
    "float",
    "long",
    "boolean",
  ].includes(t);
}

export function useRecentActivity() {
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

  const auditEntities = useMemo(() => {
    return entityList
      .map((entity, i) => {
        const schema = schemaQueries[i]?.data;
        if (!schema) return null;
        const auditAttr = schema.attributes.find((a) => a.type === "audit_metadata");
        if (!auditAttr) return null;
        const auditSortField = schema.sortableFields.find((f) => f.includes("last_modified_date"));
        const sortField = auditSortField ?? schema.sortableFields[0];
        return { entity, auditAttrName: auditAttr.name, sortField, schema };
      })
      .filter(Boolean) as Array<{
      entity: { name: string; title: string; collectionHref: string };
      auditAttrName: string;
      sortField: string | undefined;
      schema: EntitySchema;
    }>;
  }, [entityList, schemaQueries]);

  const activityQueries = useQueries({
    queries: auditEntities.map(({ entity, sortField }) => ({
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

  const activities: RecentActivityItem[] = useMemo(() => {
    const allItems: RecentActivityItem[] = [];

    auditEntities.forEach(({ entity, auditAttrName, schema }, i) => {
      const data = activityQueries[i]?.data;
      if (!data) return;

      const nameAttr = findNameAttribute(schema.attributes);
      const detailAttrs = schema.attributes.filter((a) => {
        if (a.name === "id" || a.name === nameAttr?.name) return false;
        if (["audit_metadata", "content"].includes(a.type)) return false;
        return isDisplayableScalar(a.type);
      });

      data.items.forEach((item: EntityListResult["items"][number]) => {
        const auditData = item.data[auditAttrName] as
          | {
              last_modified_by?: string;
              last_modified_date?: string;
              created_by?: string;
              created_date?: string;
            }
          | undefined;

        const modifiedDate = auditData?.last_modified_date ?? auditData?.created_date;
        if (!modifiedDate) return;

        const action: "created" | "modified" =
          auditData?.created_date &&
          auditData?.last_modified_date &&
          auditData.created_date !== auditData.last_modified_date
            ? "modified"
            : "created";

        const nameVal = nameAttr ? item.data[nameAttr.name] : undefined;
        const displayName = typeof nameVal === "string" && nameVal ? nameVal : item.id;
        const details: RecentActivityDetail[] = buildDetails(detailAttrs, item.data);

        allItems.push({
          entityName: entity.name,
          entityTitle: entity.title,
          itemId: item.id,
          displayName,
          action,
          modifiedBy: auditData?.last_modified_by ?? auditData?.created_by,
          modifiedDate,
          details,
        });
      });
    });

    allItems.sort(
      (a, b) => new Date(b.modifiedDate).getTime() - new Date(a.modifiedDate).getTime(),
    );
    return allItems;
  }, [auditEntities, activityQueries]);

  const schemasLoaded = schemaQueries.every((q) => !q.isLoading);
  return {
    activities,
    isLoading: !schemasLoaded || activityQueries.some((q) => q.isLoading),
    hasAuditEntities: schemasLoaded && auditEntities.length > 0,
  };
}
