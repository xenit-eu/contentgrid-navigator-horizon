# Data Model: Extract Metadata into the Create Form

**Feature**: [spec.md](spec.md)

No server-side data changes. All shapes below are client-side and follow the extract service contract in [contracts/extract-service.md](contracts/extract-service.md).

## Shapes (`packages/navigator-data/src/shapes.tsx`)

| Shape                      | Fields                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExtractServiceShape`      | `_links`, `_templates["basic-extract" \| "advanced-extract"]` (`HalFormsTemplateShape<ExtractRequest, ExtractionShape>`)                                                           |
| `ExtractRequest`           | `file: Blob`, `prompt: string`, `profile_endpoint: string`, `llm_provider?: string`, `search_candidates?: boolean`, `process_to_many_relations?: boolean`                          |
| `ExtractionShape`          | `root_entity: string`, `entities: EntityExtractionShape[]`                                                                                                                         |
| `EntityExtractionShape`    | `id: string`, `entity: string`, `attributes: AttributeExtractionShape[]`, `relations: RelationExtractionShape[]`, `confidence?: number`, `candidate_search?: CandidateSearchShape` |
| `AttributeExtractionShape` | `name: string`, `value: string \| number`, `confidence?: number`, `reason?: string`, `citations?: { citation: string; matches: AnnotationShape[] }[]`                              |
| `RelationExtractionShape`  | `name: string`, `ref?: string` (to-one), `refs?: string[]` (to-many)                                                                                                               |
| `CandidateSearchShape`     | `candidates: CandidateShape[]`, `deny_reason: string \| { title?, type?, status?, detail? } \| null`                                                                               |
| `CandidateShape`           | `href: string`, `confidence: number`, `matched_attributes: string[]`                                                                                                               |
| `AnnotationShape`          | `page: number`, `bbox: { left, top, width, height }` (fractions 0–1 of the page)                                                                                                   |

`ExtractRequestSpec = TypedRequestSpec<ExtractRequest, ExtractionShape>` goes in `packages/navigator-data/src/api/requests.ts`.

## Accessors

### `ExtractService` (`accessors/extract-service.ts`)

| Member                                | Returns                                             | Rule                                                                                                                                                                       |
| ------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basicExtractTemplate`                | `HalFormsTemplate<ExtractRequestSpec> \| undefined` | `resolveTemplate(home, "basic-extract")`                                                                                                                                   |
| `advancedExtractTemplate`             | `HalFormsTemplate<ExtractRequestSpec> \| undefined` | `resolveTemplate(home, "advanced-extract")`                                                                                                                                |
| `extractRequest(template, input)`     | `Request`                                           | `createValues(template)` with `file`, `profile_endpoint`, `prompt`; optional values only when declared (research D2); encoded by `halFormCodecs.requireCodecFor(template)` |
| `static homeQuery(extractFetch, url)` | query options                                       | key `queryKeys.extractService.home(url)`; `fetchHalObject` → `new ExtractService(object)`                                                                                  |

`input` is `{ file: File; profileEntity: ProfileEntity; prompt: string; llmProvider?: string; searchCandidates?: boolean; processToManyRelations?: boolean }`.

### `Extraction` and `EntityExtraction` (`accessors/extraction.ts`)

| Reference name             | Name here          | Members                                                                                                                                                                                                                                            |
| -------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ExtractionAccessor`       | `Extraction`       | `rootEntityId`, `rootEntity` (`EntityExtraction \| undefined`), `entities`, `getEntityById(id)`                                                                                                                                                    |
| `EntityExtractionAccessor` | `EntityExtraction` | `id`, `entityName`, `attributes`, `confidence`, `candidateSearch`, `candidates`, `getAttributeByName`, `getRelationByName`, `getToManyRelationByName`, `isToManyRelation`, `getAutoLinkableRelations(threshold = EXTRACTION_CONFIDENCE_THRESHOLD)` |
| `AutoLinkableRelation`     | unchanged          | `relationName`, `hrefs`, `isMultivalue`                                                                                                                                                                                                            |

`rootEntity` returns `undefined` when `root_entity` is not in `entities` (spec edge case).

## Hooks (`packages/navigator-data/src/hooks/extraction/`)

| Hook                                 | Returns                                                             | Rule                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `useExtractService()`                | `UseQueryResult<ExtractService>`                                    | reads `extractFetch` and `extractServiceUrl` from `useNavigatorData()`; `enabled` only when `extractServiceUrl` is set    |
| `useExtractMetadata(extractService)` | `UseMutationResult<Extraction, Error, ExtractInput & { template }>` | `extractFetch(extractService.extractRequest(...)).then(checkResponse)` → `.json()` → `new Extraction(json)` (research D7) |

## Data context and client (`packages/navigator-data/src`)

| Addition                                                                             | Rule                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createExtractClient(tokenSupplier, apiBaseUrl)` (`api/client.ts`)                   | Same hooks as `createApiClient`; token from a composite supplier: the user's token for the API origin, a token exchanged at the API origin's `/.contentgrid/authentication/external/token` for any other origin (research D10). |
| `NavigatorDataContextValue.extractFetch`, `.extractServiceUrl` (`hooks/context.tsx`) | Set by `useAppAuth` from `getAppConfig()`, like `renditionUri`. `extractServiceUrl` is `undefined` when not configured.                                                                                                         |
| `queryKeys.extractService.home(url)` (`query-keys.ts`)                               | Cache key of the extract home.                                                                                                                                                                                                  |

## Form state (`packages/features/src/hal-forms/state/use-hal-forms-field-state.ts`)

| Addition                              | Rule                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `suggestExternalValue(name, details)` | Shows the extraction details on the field without writing a value. The value, touched state and errors are unchanged (research D6). |

## Create container state

| Field        | Type                      | Initial     | Transitions                                                                          |
| ------------ | ------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| `extraction` | `Extraction \| undefined` | `undefined` | set after a successful extraction; `undefined` on discard and on `formState.reset()` |

## `applyExtraction(rootEntity, fields, formState)` (`entity-item-create/util/apply-extraction.ts`)

For each field in the create template:

1. Attribute with a non-null extracted value, an empty current value, and confidence absent or above the threshold → convert with `coerceFieldValue(field.property.type, String(value))`; when it converts, `setExternalValue(name, converted, details)`.
2. Relation in `rootEntity.getAutoLinkableRelations()`: to-one → `setExternalValue(name, hrefs[0], details)`; to-many → `setExternalValue(name, union(current, hrefs), details)`.
3. Any other field the extraction has data for → `suggestExternalValue(name, details)`.

Names that are not fields of the template are ignored. `details` is the `ExtractionDetails` element for that field.
