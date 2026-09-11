import { BooleanAttributeRenderer } from "./boolean-attribute-renderer";
import { ContentAttributeRenderer } from "./content-attribute-renderer";
import { CreatedByAttributeRenderer } from "./created-by-attribute-renderer";
import { CreatedDateAttributeRenderer } from "./created-date-attribute-renderer";
import { DateAttributeRenderer } from "./date-attribute-renderer";
import { DateTimeAttributeRenderer } from "./datetime-attribute-renderer";
import { ModifiedByAttributeRenderer } from "./modified-by-attribute-renderer";
import { ModifiedDateAttributeRenderer } from "./modified-date-attribute-renderer";
import { NumberAttributeRenderer } from "./number-attribute-renderer";
import { StringAttributeRenderer } from "./string-attribute-renderer";
import { UnknownAttributeRenderer } from "./unknown-attribute-renderer";

export interface AttributeRendererComponents {
  readonly boolean: typeof BooleanAttributeRenderer;
  readonly string: typeof StringAttributeRenderer;
  readonly number: typeof NumberAttributeRenderer;
  readonly date: typeof DateAttributeRenderer;
  readonly datetime: typeof DateTimeAttributeRenderer;
  readonly createdDate: typeof CreatedDateAttributeRenderer;
  readonly modifiedDate: typeof ModifiedDateAttributeRenderer;
  readonly createdBy: typeof CreatedByAttributeRenderer;
  readonly modifiedBy: typeof ModifiedByAttributeRenderer;
  readonly content: typeof ContentAttributeRenderer;
  readonly unknown: typeof UnknownAttributeRenderer;
}

export const defaultAttributeRendererComponents: AttributeRendererComponents = {
  boolean: BooleanAttributeRenderer,
  string: StringAttributeRenderer,
  number: NumberAttributeRenderer,
  date: DateAttributeRenderer,
  datetime: DateTimeAttributeRenderer,
  createdDate: CreatedDateAttributeRenderer,
  modifiedDate: ModifiedDateAttributeRenderer,
  createdBy: CreatedByAttributeRenderer,
  modifiedBy: ModifiedByAttributeRenderer,
  content: ContentAttributeRenderer,
  unknown: UnknownAttributeRenderer,
};
