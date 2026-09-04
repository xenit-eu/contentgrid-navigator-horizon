ContentGrid is focussed around HALForms.

Sometimes there is only a HALForms and Sometimes some information could have been Aggregated from the profile information

An example of this are the extended forms in packages/navigator-data/src/accessors/extended-forms

We are at the point that we want to implement rendering of forms and so on.

What we know from the contentgrid-ts library is that we have the tools to save values. with HalFormValues<EntityInstanceCreateRequestSpec> from import type { HalFormValues } from "@contentgrid/hal-forms/values";

with  
const codec = halFormCodecs.requireCodecFor(searchTemplate.template);
return codec.encode(values);

We can encode these values and send them as a request later on through the navigator-data package which returns us a tanstack mutation or query.

In the sense of extensibility and adherence to HAL I want to have A structured approach in:
Displaying the HalFormProperties
Saving the updates to the properties
Allow external systems to influence the values of the properties
Render custom errors in the fields
-> external errors (backend reported and error for a field)
-> internal error (value does not adhere to regEx or is of an incorrect type or isRequired from a HAL forms value)

Displaying HalFormProperties, configuring the layout

This translation service should remain out navigator-data.
It is the concern of the surrounding app and not the data fetching library.

This Translation service takes a form or an extended form

transformHalFormToFieldDescriptors(HalFormsTemplate)
transformCreateHalFormToFieldDescriptors(createFormTemplate)
transformSearchHalFormToFieldDescriptors(...)

-> returns a FieldDescriptors and LayoutInformation
unclear how that would work

export interface RenderFieldDescriptorBase {
readonly name: string;
readonly label: string;
readonly required: boolean;
readonly readOnly: boolean;
readonly description?: string;
...
}

LayoutInformation should contain information about where the properties are situated in the form. Are they horizontal aligned, vertical aligned and so on... This should also apply if there are custom userPreferences

After the transformation to fieldDescriptors is done

pass the layoutInformation and FieldDescriptors to a FormContainer

this FormContainer takes as props:
fieldDescriptors,
values
setValues
setValue
renderAdditionalBottomChildren (field ) => React.Node
externalErrors (field) => string[]

ExternalErrors can be field Valdiation UniqueNess contraint failed or RelationConflicts via problem-details

and a logic for rendering

/\*\* Renders->
for each field and based on layout ->
FieldRenderer
renderField={field}
value={values[field.name]}
onChange={(value) => setValue(field.name, value)}
error={formFields.errors[field.name]}
bottomChildren={<Icon/> has tooltip with additional information for instance}

    <Button>Submit</Button>

\*/
// FieldRenderer
// has a switch and mechanism to decide how the field should render.
// -> take a look if we can use this for the search form

// Should work and fetch data if needed.
// If it receives a related item or url as a value. it should be able to fetch the related item and correctly render.
// All standard hooks should also be accept like onFocus, onHover and so on...

The example of a create form

// CreateEntityItemContainer
// keeps track of the values
// submits the request
// triggers the onCreate hook
// triggers external automations that fill in values
// state of extra information about the forms
// validation error state (backend gave an error for this field)
// aditional information (in this field render a custom tooltip with info ... for instance this field was extracted by AI)

// Renders ->
// CreateEntityItemForm
// createHalFormTemplate
// values
// setValues
// setValue
// renderAdditionalBottomChildren (field.name ) => React.Node
// externalErrors (field) => string[]

// CreateEntityItemForm
// It reads the template and transforms it into createFormToRenderFields
// If later there need to be layout customization or custom fieldrenderers based on userPreferences this step should detect and enclose that information
