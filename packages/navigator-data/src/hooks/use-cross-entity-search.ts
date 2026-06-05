import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { EntityInfo, EntitySchema } from "../types/entity";
import { useNavigatorData } from "./context";
import { queryKeys } from "./query-keys";
import { fetchEntityList } from "./use-entity-list";
import { fetchEntitySchema } from "./use-entity-schema";
import { useProfile } from "./use-profile";

export interface CrossEntitySearchResult {
  entityName: string;
  entityTitle: string;
  items: Array<{
    id: string;
    selfHref: string;
    displayFields: Array<{ label: string; value: string }>;
    matchedVia?: string;
  }>;
  totalItems?: number;
  searchField: string;
}

export function useCrossEntitySearch(query: string, options?: { size?: number }) {
  const size = options?.size ?? 5;
  const { apiFetch } = useNavigatorData();
  const { data: entities } = useProfile();
  const entityList = useMemo(() => entities ?? [], [entities]);

  const schemaQueries = useQueries({
    queries: entityList.map((entity) => ({
      queryKey: queryKeys.entitySchema(entity.name),
      queryFn: () => fetchEntitySchema(apiFetch, entity.href),
      staleTime: Infinity,
      // Only fetch schemas when there is actually a search term — avoids a
      // full fan-out at mount time before the user has typed anything.
      enabled: query.length >= 2,
    })),
  });

  const searchableEntities = useMemo(() => {
    if (query.length < 2) return [];
    return entityList
      .map((entity, i) => {
        const schema = schemaQueries[i]?.data;
        if (!schema || schema.searchProperties.length === 0) return null;
        const prefixProp = schema.searchProperties.find((p) => p.name.endsWith("~prefix"));
        const searchField = prefixProp?.name ?? schema.searchProperties[0]?.name;
        if (!searchField) return null;
        const relationFields = schema.searchProperties
          .filter((p) => p.name.includes(".") && p.name.endsWith("~prefix"))
          .map((p) => ({
            field: p.name,
            label: p.prompt ?? p.name.replace("~prefix", "").replace(".", " "),
          }));
        return { entity, searchField, schema, relationFields };
      })
      .filter(Boolean) as Array<{
      entity: EntityInfo;
      searchField: string;
      schema: EntitySchema;
      relationFields: Array<{ field: string; label: string }>;
    }>;
  }, [entityList, schemaQueries, query]);

  const searchQueryConfigs = useMemo(() => {
    return searchableEntities.flatMap(({ entity, searchField, relationFields }) => [
      {
        entityName: entity.name,
        collectionHref: entity.collectionHref,
        field: searchField,
        isRelation: false,
        relationLabel: undefined as string | undefined,
      },
      ...relationFields.map((rf) => ({
        entityName: entity.name,
        collectionHref: entity.collectionHref,
        field: rf.field,
        isRelation: true,
        relationLabel: rf.label,
      })),
    ]);
  }, [searchableEntities]);

  const searchQueries = useQueries({
    queries: searchQueryConfigs.map(({ entityName, collectionHref, field }) => ({
      queryKey: queryKeys.entityList(entityName, { size, search: query, searchField: field }),
      queryFn: () =>
        fetchEntityList(apiFetch, collectionHref, { size, search: query, searchField: field }),
      enabled: query.length >= 2,
    })),
  });

  const results: CrossEntitySearchResult[] = useMemo(() => {
    if (query.length < 2) return [];

    const grouped = new Map<
      string,
      {
        entity: (typeof searchableEntities)[number];
        items: Map<string, CrossEntitySearchResult["items"][number]>;
        totalDirect?: number;
      }
    >();

    searchQueryConfigs.forEach((config, i) => {
      const data = searchQueries[i]?.data;
      if (!data || data.items.length === 0) return;

      const entityInfo = searchableEntities.find((e) => e.entity.name === config.entityName);
      if (!entityInfo) return;

      if (!grouped.has(config.entityName)) {
        grouped.set(config.entityName, { entity: entityInfo, items: new Map() });
      }
      const group = grouped.get(config.entityName)!;
      if (!config.isRelation) group.totalDirect = data.totalItems;

      const textAttrs = entityInfo.schema.attributes.filter((a) => {
        const t = a.type.toLowerCase();
        return (
          (t === "text" || t === "string" || t === "decimal" || t === "double") && a.name !== "id"
        );
      });

      for (const item of data.items) {
        if (!group.items.has(item.id)) {
          group.items.set(item.id, {
            id: item.id,
            selfHref: item.selfHref,
            displayFields: textAttrs.slice(0, 3).flatMap((attr) => {
              const val = item.data[attr.name];
              if (val == null || val === "") return [];
              return [
                {
                  label: attr.title,
                  value: typeof val === "object" ? JSON.stringify(val) : String(val),
                },
              ];
            }),
            matchedVia: config.isRelation ? config.relationLabel : undefined,
          });
        }
      }
    });

    return Array.from(grouped.values())
      .map(({ entity, items, totalDirect }) => ({
        entityName: entity.entity.name,
        entityTitle: entity.entity.title,
        searchField: entity.searchField,
        totalItems: Math.max(totalDirect ?? items.size, items.size),
        items: Array.from(items.values()).slice(0, size),
      }))
      .filter((r) => r.items.length > 0);
  }, [query, size, searchableEntities, searchQueryConfigs, searchQueries]);

  return {
    results,
    isSearching: query.length >= 2 && searchQueries.some((q) => q.isLoading),
    totalResults: results.reduce((sum, r) => sum + (r.totalItems ?? r.items.length), 0),
  };
}
