import type { HalFormsTemplateShape } from "@contentgrid/hal-forms/shape";
import type { HalObjectShape, HalSliceShape, LinksShape } from "@contentgrid/hal/shape";
import type { RequestBodyType, ResponseBodyType, TypedRequestSpec } from "@contentgrid/typed-fetch";
import type {
  EntityInstanceDeleteRequestSpec,
  EntityInstanceUpdateRequestSpec,
  RelationDeleteRequestSpec,
  RelationUpdateRequestSpec,
} from "./api/requests";

type HalFormsTemplateShapeFromRequest<RS extends TypedRequestSpec<unknown, unknown>> =
  HalFormsTemplateShape<RequestBodyType<RS>, ResponseBodyType<RS>>;

export interface ProfileEntityShape {
  readonly name: string;
  readonly description: string;
  readonly _links?: LinksShape;
  readonly _templates?: {
    readonly search?: HalFormsTemplateShape<void, EntityCollectionShape>;
    readonly "create-form"?: HalFormsTemplateShape<EntityInstanceForUpdate, EntityInstanceShape>;
  };
}

export interface ProfileAttributeShape {
  readonly name: string;
  readonly type: string;
  readonly title?: string;
  readonly description: string;
  readonly readonly: boolean;
  readonly required?: boolean;
  readonly _links?: LinksShape;
}

export interface ProfileAttributeConstraint {
  readonly type: string;
  readonly values?: string[];
}

export interface ProfileAttributeSearchParam {
  readonly name: string;
  readonly title: string;
  readonly type: string;
}

export interface ProfileRelationShape {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly many_source_per_target: boolean;
  readonly many_target_per_source: boolean;
  readonly required: boolean;
  readonly _links?: LinksShape;
}

export interface EntityCollectionShape extends HalSliceShape<EntityInstanceShape> {
  readonly page: PageMetadataShape;
}

export type PageMetadataShape = {
  readonly total_items_estimate: number;
  readonly total_items_exact?: number;
};

export type EntityInstanceShape = HalObjectShape<{
  readonly id: string;
  readonly [k: string]: unknown;
  readonly _templates?: {
    readonly default?: HalFormsTemplateShapeFromRequest<EntityInstanceUpdateRequestSpec>;
    readonly delete?: HalFormsTemplateShapeFromRequest<EntityInstanceDeleteRequestSpec>;
    readonly [k: `add-${string}`]: HalFormsTemplateShapeFromRequest<RelationUpdateRequestSpec>;
    readonly [k: `set-${string}`]: HalFormsTemplateShapeFromRequest<RelationUpdateRequestSpec>;
    readonly [k: `clear-${string}`]: HalFormsTemplateShapeFromRequest<RelationDeleteRequestSpec>;
  };
}>;

type WithoutHal<T extends HalObjectShape<Record<string, unknown>>> = Omit<
  T,
  "_links" | "_embedded" | "_templates"
>;
export type EntityInstanceForUpdate = Omit<WithoutHal<EntityInstanceShape>, "id">;
