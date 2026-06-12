export const queryKeys = {
  profile: () => ["profile"] as const,
  entityProfile: (entityName: string) => ["entity-profile", entityName] as const,
  entitySchema: (entityName: string) => ["entity-schema", entityName] as const,
  entityList: (entityName: string, params?: Record<string, unknown>) =>
    ["entity-list", entityName, params ?? {}] as const,
  entityDetail: (entityName: string, entityId: string) =>
    ["entity-detail", entityName, entityId] as const,
  entityRelations: (entityName: string, entityId: string, relationName: string) =>
    ["entity-relations", entityName, entityId, relationName] as const,
  entityCount: (entityName: string) => ["entity-count", entityName] as const,
  searchSuggestions: (entityName: string, field: string, query: string) =>
    ["search-suggestions", entityName, field, query] as const,
};
