import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { AuditRoles, EntitySchema } from "../types/entity";
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
        const auditRoles = auditAttr.auditRoles ?? {};
        // Sort by the profile-discovered modified-date sub-attribute name, not a
        // hardcoded "last_modified_date" string.
        const modifiedDateField = auditRoles["modified-date"];
        const auditSortField = modifiedDateField
          ? schema.sortableFields.find((f) => f.includes(modifiedDateField))
          : undefined;
        const sortField = auditSortField ?? schema.sortableFields[0];
        return { entity, auditAttrName: auditAttr.name, auditRoles, sortField, schema };
      })
      .filter(Boolean) as Array<{
      entity: { name: string; title: string; collectionHref: string };
      auditAttrName: string;
      auditRoles: AuditRoles;
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

    auditEntities.forEach(({ entity, auditAttrName, auditRoles, schema }, i) => {
      const data = activityQueries[i]?.data;
      if (!data) return;

      const nameAttr = findNameAttribute(schema.attributes);
      const detailAttrs = schema.attributes.filter((a) => {
        if (a.name === "id" || a.name === nameAttr?.name) return false;
        if (["audit_metadata", "content"].includes(a.type)) return false;
        return isDisplayableScalar(a.type);
      });

      // Resolve the actual sub-attribute names from the profile-discovered audit
      // roles instead of assuming literal field names.
      const createdDateField = auditRoles["created-date"];
      const createdByField = auditRoles["created-by"];
      const modifiedDateField = auditRoles["modified-date"];
      const modifiedByField = auditRoles["modified-by"];

      data.items.forEach((item: EntityListResult["items"][number]) => {
        const auditData = item.data[auditAttrName] as Record<string, unknown> | undefined;

        // Prefer the modified-date; fall back to created-date if only one is available.
        const modifiedDate =
          (modifiedDateField == null
            ? undefined
            : (auditData?.[modifiedDateField] as string | undefined)) ??
          (createdDateField == null
            ? undefined
            : (auditData?.[createdDateField] as string | undefined));
        if (!modifiedDate) return;

        const createdDateVal =
          createdDateField == null
            ? undefined
            : (auditData?.[createdDateField] as string | undefined);
        const modifiedDateVal =
          modifiedDateField == null
            ? undefined
            : (auditData?.[modifiedDateField] as string | undefined);

        const action: "created" | "modified" =
          createdDateVal && modifiedDateVal && createdDateVal !== modifiedDateVal
            ? "modified"
            : "created";

        const nameVal = nameAttr ? item.data[nameAttr.name] : undefined;
        const displayName = typeof nameVal === "string" && nameVal ? nameVal : item.id;
        const details: RecentActivityDetail[] = buildDetails(detailAttrs, item.data);

        const modifiedByVal =
          modifiedByField == null
            ? undefined
            : (auditData?.[modifiedByField] as string | undefined);
        const createdByVal =
          createdByField == null ? undefined : (auditData?.[createdByField] as string | undefined);

        allItems.push({
          entityName: entity.name,
          entityTitle: entity.title,
          itemId: item.id,
          displayName,
          action,
          modifiedBy: modifiedByVal ?? createdByVal,
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
