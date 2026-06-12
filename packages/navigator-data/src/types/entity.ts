export interface EntityInfo {
  name: string;
  title: string;
  /** Full URL of the HAL-FORMS entity profile, e.g. https://api.example.com/profile/invoices */
  href: string;
  /** Full URL of the entity collection, e.g. https://api.example.com/invoices.
   * Sourced from the root resource's cg:entity link href (matched by name), not derived
   * from the profile URL via string replacement. */
  collectionHref: string;
  /** RFC 6570 URI template for a single item, e.g. https://api.example.com/invoices/{id}.
   * Sourced from the entity profile's _links.describes item link (templated: true).
   * Falls back to collectionHref + "/{id}" if the describes link is absent. */
  itemTemplateHref: string;
}

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
