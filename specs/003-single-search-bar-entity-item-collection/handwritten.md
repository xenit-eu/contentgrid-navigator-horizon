# The single search bar for an entity item collection.

The single search bar for an entity item collection is a general search bar that can be used for searching an entityProfile based on the different attributes.

The search bar consists three stacked rows.

the first row are the search chips.

these search chips indicate the current search filters that are active.
Each search chip has a close button next to it. When the close button is clicked the current filter is no longer applied instantly. in each chip the search mode is clearly visible and should have been built by using a primitive. The search chips should be horizontally scrollable and not take more than two lines.

the second row is the main searchbar.

The main searchbar consists of two horizontal columns.
The first column is an search param selector. For each search param there should be a clear indicator of the search type.

The search params should be grouped based on the relations (given there are relations).

The search param selector:

Types included in the search param selector:
ALL -> default selected
ALL - (excluded relations)
TEXT - prefix , FTS, exact and allowed values
INTEGER - exact
DECIMAL - exact

The main search bar:

This is a free form text typing.

Behaviour based on the selected search param in the search param selector

ALL

User starts typing (minimum one character).

Popover opens.

### Popover content:

#### TOP ROW search param selector chips (horizontal layout)

Top row shows the seach param selector option chips.
seach param selector option chips filter based on the input.
If there are searches done on that chip, read the exact or estimated count and add that to the chips as a number of the expected results by filtering on this search param. (if unknown, in the case of exact searches add ? as the count)

- text is inputted -> filter out the INTEGER and DECIMAL search
- number is inputted -> show integer and decimals first, text search params after but not filtered out.

If a search param is selected, the search param selector shows the selected value and the popover content only shows suggestions for that selected search parameter.

#### POPOVER Content (vertical layout with search param group names)

Grouped by each prefix or FTS search parameter.
Max 10 suggested values per attribute.

FTS and PREFIX
Suggestions are found by doing actual searches based on the current input

ALLOWED VALUES
The ALLOWED values are known beforehand, in the inline options of the halform template property there should be client side prefix filtering based on these values.

When a suggested value is clicked. The param and suggested value is added as a search chip and the search param selector flips back to the ALL default.

Each group header should also display the amount of estimated or exact results.

If a search param is selected in the selector. the content should filter and only do searches on the selected search param.

In case there are no suggestions possible (integer and decimal case) you have no popover.

At any point, if the user presses enter and a search param is selected (not all mode) the search is fired (no suggestion was selected so the current input serves as the search value in case of a prefix search)

Row three quick filters.

Horizontal row of buttons that open popover clearly linked to the button.
Quick filters are there to help filter on other types of search params

# Common behaviour

when some filtering is done on the search param (through the url state / advanced filters / or through the quick filter itself)
The botton gets a blue outline indicating the quick filter is active. In the button itself there is a cross button that can be used to remove the quick filter.

## Date & DateTime properties

clicking opens a popover that has the range calendar on the left. on the right quick sort options Last day, last week, last month and last year (CLEAR) (APPLY) button.

## Boolean properties

clicking does not open a popover. the button changes the outline of the button, green means true, red means false, grey is unset (filter is not active). The buttons should use the icons also used in the boolean chips to display the value.

## Integer / DECIMAL properties

clicking opens a popover. In the popover we have an exact search integer/decimal input, on the bottom we have two inputs the Min and Max search properties next to each other. Below we have {Clear} and {Apply}.

# Allowed values

Clicking opens a popover. The popover opens a select and on top a search bar. The search bar filters the allowed values, similar to how the search suggestions are generated for the popover.

# Created AT audit property

Works similar to a date example. only has a dedicated icon for created.

# Last modified at audit property

Works similar to a date example. only has a dedicated icon for modified.

### Configurability.

The configuration layer and user preferences has influence on which search properties should be included. The user preferences should be gated by AttributeProfiles and not by search params. Similar to the selected columns the configuration decides which attributeProfiles should be included in the single search bar for an entity collection. For searches over relation there should not be any configuration for now. they can always be included.
