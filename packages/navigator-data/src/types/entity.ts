export interface EntityInfo {
  name: string;
  title: string;
  href: string;
  collectionHref: string;
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
