import type { HalFormsTemplate } from "@contentgrid/hal-forms";
import type { EntityInstanceUpdateRequestSpec } from "../../api/requests";
import type ProfileEntity from "../entity-profile";
import { type FormAttributeProperty, toFormAttributeProperty } from "./form-property";

/**
 * Wrapper for an entity item's `default` HAL-FORMS template — the update form.
 *
 * The update template lists only attribute properties: relations are changed through their own
 * `set-`/`add-`/`clear-` templates. A content attribute appears as two text properties,
 * `<attr>.filename` and `<attr>.mimetype`, instead of the create form's single `file` property.
 *
 * The template carries no `value`s; the form is prefilled from `EntityItem.updateFormValues`.
 * Built per item by `EntityItem.updateTemplate`.
 */
export class UpdateHalFormTemplate {
  private _userDefinedProperties?: readonly FormAttributeProperty[];

  constructor(
    /** The underlying HAL-FORMS template */
    public readonly template: HalFormsTemplate<EntityInstanceUpdateRequestSpec>,
    /** The profile accessor for attribute linking */
    private readonly profileEntity: ProfileEntity,
  ) {}

  /** Attribute properties, enhanced with profile metadata. */
  get userDefinedProperties(): readonly FormAttributeProperty[] {
    this._userDefinedProperties ??= (this.template.properties ?? []).map((property) =>
      toFormAttributeProperty(property, this.profileEntity),
    );
    return this._userDefinedProperties;
  }
}
