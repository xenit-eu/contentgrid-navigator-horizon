In this project and the consition we are explicitly working with the hal spec and more specifically hal from templates. The spec can be found on http://rwcbook.com/hal-forms/

In the features/hal-forms I want to build a generic form renderer that works with any halforms template input.

An example of a create hal form template with properties are:

"create-form": {
"method": "POST",
"target": "https://a41f29cd-fa71-4ed9-8f73-06e3065a1256.eu-west-1.contentgrid.cloud/all-attributeses",
"contentType": "multipart/form-data",
"properties": [
{
"name": "text_allowed_values",
"options": {
"inline": [
"constraintA",
"constraintB",
"constraintC",
"constraintD",
"constraintE"
],
"maxItems": 1,
"minItems": 0
},
"prompt": "Text allowed values",
"type": "text"
},
{
"name": "boolean_example",
"prompt": "Boolean example",
"type": "checkbox"
},
{
"name": "date_example",
"prompt": "Date example",
"type": "date"
},
{
"name": "datetime_example",
"prompt": "Datetime example",
"type": "datetime"
},
{
"name": "content_a",
"prompt": "Content a",
"type": "file"
},
{
"name": "content_b",
"prompt": "Content b",
"type": "file"
},
{
"name": "decimal_example",
"prompt": "Decimal example",
"type": "number"
},
{
"name": "integer_example",
"prompt": "Integer example",
"type": "number"
}
]
}
},

a search form example:

"search": {
"method": "GET",
"target": "https://a41f29cd-fa71-4ed9-8f73-06e3065a1256.eu-west-1.contentgrid.cloud/articles",
"properties": [
{
"name": "title~prefix",
"prompt": "Title",
"type": "text"
},
{
"name": "summary~prefix",
"prompt": "Summary",
"type": "text"
},
{
"name": "summary~fts",
"prompt": "Summary: Full Text",
"type": "text"
},
{
"name": "text",
"prompt": "Text",
"type": "text"
},
{
"name": "text~fts",
"prompt": "Text: Full Text",
"type": "text"
},
{
"name": "\_sort",
"options": {
"inline": [
{
"property": "text",
"direction": "asc",
"prompt": "Text A→Z",
"value": "text,asc"
},
{
"property": "text",
"direction": "desc",
"prompt": "Text Z→A",
"value": "text,desc"
}
],
"minItems": 0,
"promptField": "prompt",
"valueField": "value"
},
"prompt": "Sort",
"type": "text"
}
]
},

The contentgrid-ts library takes most of the hard work for us. Additionally for the create and search form we extended the form to include additional information. Currently the search and create form both use a different mechanism which we would like to combine eventually with this current features/hal-form feature.

Requirements for the INPUTS of the form:

each input should be able to recieve a validation error. Based on current data and/or a validation function or based on a external problem Validation response. (the value must be unique over the whole repository for instance)

On start, or while the form is rendered it should be possible for external automations to fill the values in there.

Each input field on the lefthand bottom should also be able to render a ProvenanceTag.

Standard onBlur onTouch onChange hooks should be available.

Special case inputs in the FIELD descriptors:

there should be an autocomplete type. Take a look at the autocomplete of the searchFilterBar to see how it works.

Arrange fields into two-column rows

The form input should also receive a layoutSchema which arranges the fields into two-column rows.

This layoutSchema will later be adjustable by administrators.

For the searchforms I want a schema builder that places the ~before and ~after of the same search property on the same row.

Also when field are left out of the layoutschema i don't want to see them in the form.

When there is only one input on one row it should take the full width of that row.
