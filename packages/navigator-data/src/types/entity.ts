export interface EntityInfo {
  name: string;
  title: string;
  href: string;
  collectionHref: string;
}

/**
 * Audit role served by a sub-attribute inside an `audit_metadata` object
 * attribute.  Derived from `blueprint:constraint` entries of the four
 * system-managed types (`created-date`, `created-by`, `modified-date`,
 * `modified-by`).  Only present on attributes whose `type` is
 * `"audit_metadata"` — absent on all other attribute types.
 */
export type AuditSubAttributeRole = "created-date" | "created-by" | "modified-date" | "modified-by";

/**
 * When `type === "audit_metadata"` this map is populated with the discovered
 * sub-attribute names keyed by their audit role.  Consumers MUST read field
 * names from here instead of hardcoding names like `created_by` /
 * `last_modified_date`.
 */
export type AuditRoles = Partial<Record<AuditSubAttributeRole, string>>;

export interface EntityAttribute {
  name: string;
  title: string;
  type: string;
  description?: string;
  readOnly: boolean;
  required: boolean;
  unique: boolean;
  searchable: boolean;
  prefixSearchable: boolean;
  allowedValues?: string[];
  /**
   * Only present when `type === "audit_metadata"`.  Maps each audit role to
   * the sub-attribute name that carries it in the entity data payload.
   * Derived from `blueprint:constraint` entries with system-managed types on
   * each sub-attribute.
   */
  auditRoles?: AuditRoles;
}

export interface EntityRelation {
  name: string;
  title: string;
  manyToOne: boolean;
  manyToMany: boolean;
  targetEntityHref?: string;
}

export interface SearchProperty {
  name: string;
  prompt?: string;
  type: string;
  options?: { inline?: string[] };
}

export interface CreateFormRelation {
  name: string;
  title: string;
  targetEntityName: string;
  required: boolean;
  manyToOne: boolean;
}

export interface SortOption {
  value: string;
  property: string;
  prompt: string;
}

export interface EntitySchema {
  description?: string;
  attributes: EntityAttribute[];
  relations: EntityRelation[];
  searchProperties: SearchProperty[];
  sortableFields: string[];
  sortOptions: SortOption[];
  createFormRelations: CreateFormRelation[];
}
