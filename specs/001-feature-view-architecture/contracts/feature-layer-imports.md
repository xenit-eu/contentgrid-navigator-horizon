# Contract: Feature Layer Imports

## Allowed Direction

```text
apps -> views -> components -> forms
          |           |          |
          +-----------+----------+-> util

views, components, forms -> @contentgrid/ui
views, components, forms, util -> @contentgrid/navigator-data
```

## Layer Rules

| Importer     | May import                                              | Must not import                                  |
| ------------ | ------------------------------------------------------- | ------------------------------------------------ |
| `views`      | components, forms, util, layout, UI, navigator-data     | apps                                             |
| `components` | forms, util, UI, navigator-data                         | views, apps                                      |
| `forms`      | util, UI, navigator-data                                | components, views, apps                          |
| `util`       | other util modules, navigator-data                      | UI, forms, components, views, apps               |
| `ui`         | UI-local modules and approved presentation dependencies | navigator-data, features, apps, Layer-1 packages |

No feature responsibility imports a Layer-1 `@contentgrid/*` package directly. Explicit named
re-exports from `@contentgrid/navigator-data` remain the sanctioned access path.

## Scope

The rule applies immediately to new files under responsibility folders. Existing feature files
outside those folders migrate in separately scoped work and remain under current package rules until
moved.

## Enforcement Messages

Each lint failure reports the importing responsibility, forbidden target, and allowed ownership
location or data boundary.
