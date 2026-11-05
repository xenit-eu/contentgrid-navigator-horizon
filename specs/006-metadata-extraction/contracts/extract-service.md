# Contract: Extract Service

**Feature**: [../spec.md](../spec.md)

The extract service is an external HAL service. This Navigator depends only on what is listed here. Everything else the home offers is ignored.

## Home: `GET {extractServiceUrl}`

- The URL comes from the runtime app config (`extractServiceUrl`). The extraction request's URL, method and content type come from the templates below. The token-exchange URL (next point) is the only URL the client builds.
- Requests are sent with `extractFetch`. The extract service is a separate origin, so it never receives the user's application token: the client exchanges it at the application API origin's `/.contentgrid/authentication/external/token` and sends the exchanged token as `Authorization: Bearer`.
- The exchange is a `POST` to `{apiOrigin}/.contentgrid/authentication/external/token` with the user's token and an `application/x-www-form-urlencoded` body: `grant_type=https://contentgrid.cloud/oauth2/grant/extension-token` and `resource=<the extract URL being called>`. The answer is an OAuth token response (`token_type: Bearer`, `access_token`, `expires_in`). Each call to the extract service gets a fresh exchanged token; nothing is cached.
- `Accept` is `application/prs.hal-forms+json, application/hal+json, application/json`, as for every other request.
- The response is HAL with `_templates`:

| Template           | Used | Notes                                                          |
| ------------------ | ---- | -------------------------------------------------------------- |
| `basic-extract`    | yes  | Extraction without reasons.                                    |
| `advanced-extract` | yes  | Extraction with `reason` per attribute ("Explain reasoning").  |
| `classification`   | no   | Not part of this feature; follow-up to `004-create-item-page`. |
| `autocomplete`     | no   | Not part of this feature.                                      |

The `method`, `target` and `contentType` of each template are read from the template and never hard-coded. The values the live service publishes have not been recorded in this repo yet. Plan step 2 captures the home from the mock service as a test fixture.

## Template properties

| Property                    | Required by the client | Value                                                                                      |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `file`                      | always                 | The `File` held by the create form's first file field.                                     |
| `profile_endpoint`          | always                 | `profileEntity.link.href` of the entity being created.                                     |
| `prompt`                    | always                 | The user's hint; an empty string when none is given.                                       |
| `llm_provider`              | only when declared     | The user's choice from the property's inline options; the property's value is the default. |
| `search_candidates`         | only when declared     | The "Search for candidates" choice (default on).                                           |
| `process_to_many_relations` | only when declared     | The "Extract to-many relations" choice (default off).                                      |

## Response

Success: JSON in the `ExtractionShape` described in [../data-model.md](../data-model.md). It is not HAL, so there are no links to follow. Attribute values are `string | number`; they are converted to each create field's type before they are written. The exact formats the service uses for dates and booleans are not recorded yet; the fixture from plan step 2 settles them.

- `root_entity` names the entity in `entities` that corresponds to the item being created.
- Relations reference other entries in `entities` by `id` (`ref` for to-one, `refs` for to-many).
- `candidate_search.candidates[].href` are item URLs of existing application items. They are used as relation values and fetched exactly as given, never parsed.

Failure: `application/problem+json`, shown through the existing problem-details display (spec FR-008).
