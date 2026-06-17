# Navigator Data Accessors — Design Principles

This document captures the architectural patterns and design decisions for the accessor layer in `@contentgrid/navigator-data`.

---

## Core Architecture

### Three-Layer Pattern

The accessor layer follows a three-tier architecture that separates concerns while maintaining flexibility:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: React Hooks (use*.ts)                             │
│  - Auto-inject context (apiFetch, profileUrl)               │
│  - React-idiomatic API                                      │
│  - Export: useProfileEntity(), useProfileEntities()         │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Static QueryOptions (class methods)               │
│  - Co-located with domain models                            │
│  - Reusable outside React (loaders, tests)                  │
│  - Export: ProfileEntity.profileByLinkQuery()               │
└─────────────────────────────────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Fetch Functions (async functions)                 │
│  - Pure data fetching logic                                 │
│  - Export: getProfileEntity(), getProfileRoot()             │
└─────────────────────────────────────────────────────────────┘
```

**Benefits:**

- **Layer 1**: Testable, framework-agnostic data fetching
- **Layer 2**: Reusable query definitions with type safety
- **Layer 3**: Minimal boilerplate in React components

---

## Design Principles

### 1. Static QueryOptions on Domain Classes

**Pattern**: Co-locate TanStack Query configuration with the domain model class.

```typescript
// ✅ Good: Query logic lives with the domain model
export default class ProfileEntity {
  public static profileByLinkQuery(
    apiFetch: TypedFetch,
    profileLink: Link,
    override: QueryOptionsOverride<ProfileEntity, Error> = {},
  ) {
    return queryOptions({
      queryKey: ["entity-profile", profileLink.name, profileLink.href],
      queryFn: async () => {
        const { object } = await fetchHal<ProfileEntityShape>(apiFetch, new Request(profileLink.href));
        return new ProfileEntity(profileLink, object);
      },
      staleTime: PROFILE_STALE_TIME,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      ...override,
    });
  }

  // Domain properties and methods...
  public get name(): string { ... }
  public get attributes(): readonly ProfileAttribute[] { ... }
}
```

**Rationale:**

- Single source of truth for query keys and fetch logic
- Autocomplete shows available queries: `ProfileEntity.` → suggests all query methods
- Enforces consistent data transformation (e.g., always returns `ProfileEntity` instance)
- Usable in React components, router loaders, and tests

**Anti-pattern:**

```typescript
// ❌ Bad: Query logic scattered in hooks
const { data } = useQuery({
  queryKey: ["profile", link.href], // ← Duplicated across files
  queryFn: () => fetch(link.href).then((r) => r.json()), // ← No transformation
});
```

---

### 2. Hooks for Context Injection

**Pattern**: Wrap static queryOptions methods in hooks that auto-inject context.

```typescript
// Static method (Layer 2) - requires explicit parameters
ProfileEntity.entityProfileQuery(apiFetch, profileUrl, { name: "invoice" });

// Hook (Layer 3) - auto-injects context
export function useProfileEntity(filter: ProfileEntityFilter, options?: UseProfileEntityOptions) {
  const { apiFetch, profileUrl } = useNavigatorData(); // ← Auto-inject
  return useQuery(
    ProfileEntity.entityProfileQuery(apiFetch, profileUrl, filter, {
      enabled: hasFilter,
      ...options?.queryOptionsOverride,
    }),
  );
}

// Component usage - clean and simple
const { data: profile } = useProfileEntity({ name: "invoice" });
```

**Benefits:**

- Component code stays simple and focused
- Context (apiFetch, profileUrl) automatically available
- Still allows direct usage of static methods when needed (loaders, prefetching)

---

### 3. Parametrized Query Options

**Pattern**: Extract configuration constants and provide consistent defaults.

```typescript
// Configuration constants
const PROFILE_STALE_TIME = 5 * 60 * 1000; // 5 minutes - profiles rarely change at runtime

// Apply consistently across all query methods
public static profileByLinkQuery(..., override = {}) {
  return queryOptions({
    queryKey: [...],
    queryFn: ...,
    staleTime: PROFILE_STALE_TIME,     // ← From constant
    gcTime: 10 * 60 * 1000,            // ← 2x staleTime (best practice)
    retry: 3,                          // ← Explicit retry policy
    ...override,                       // ← User overrides
  });
}
```

**Rationale:**

- Single source of truth for cache policies
- Easy to adjust globally (change one constant)
- Explicit defaults > implicit framework defaults
- Override mechanism maintains flexibility

---

### 4. useQueries Over Promise.all

**Pattern**: Use `useQueries` for fetching multiple related resources instead of `Promise.all`.

```typescript
// ❌ Old: Promise.all - single cache entry, all-or-nothing
export async function getProfileEntities(apiFetch, profileUrl) {
  const rootProfile = await getProfileRoot(apiFetch, profileUrl);
  return Promise.all(
    rootProfile.links.findLinks(cgRels.entity).map(async (link) => {
      const { object } = await fetchHal(apiFetch, new Request(link.href));
      return new ProfileEntity(link, object);
    }),
  );
}

// ✅ New: useQueries - individual cache entries, granular states
export function useProfileEntities(options) {
  const { apiFetch, profileUrl } = useNavigatorData();

  const { data: rootProfile } = useQuery(profileRootQuery(apiFetch, profileUrl));
  const entityLinks = rootProfile?.links.findLinks(cgRels.entity) ?? [];

  return useQueries({
    queries: entityLinks.map((link) =>
      ProfileEntity.profileByLinkQuery(apiFetch, link, options?.queryOptionsOverride),
    ),
    combine: (results) => results, // Return all individual results
  });
}
```

**Benefits:**

- **Granular cache**: Each profile cached separately by its link
- **Partial success**: Some profiles can load while others fail/load
- **Progressive rendering**: UI updates as each profile loads
- **Individual refetch**: Refetch only what changed
- **Better UX**: Show progress per-item instead of blocking on all

**Usage in components:**

```typescript
const profileResults = useProfileEntities();

// Extract successfully loaded profiles
const loadedProfiles = profileResults.filter((result) => result.data).map((result) => result.data!);

// Check states
const isLoading = profileResults.some((r) => r.isPending);
const hasErrors = profileResults.some((r) => r.isError);
const errors = profileResults.filter((r) => r.isError).map((r) => r.error);
```

---

### 5. Standalone Functions for System-Level Operations

**Pattern**: Keep system-level operations (discovery, root resources) as standalone functions, not class methods.

```typescript
// ✅ Good: Profile root is system-level, not entity-specific
export async function getProfileRoot(apiFetch: TypedFetch, profileUrl: string) { ... }
export function profileRootQuery(apiFetch: TypedFetch, profileUrl: string, override = {}) { ... }

// ✅ Good: Entity-specific operations are class methods
export default class ProfileEntity {
  public static profileByLinkQuery(...) { ... }
  public static entityProfileQuery(...) { ... }
}
```

**Rationale:**

- **Semantic clarity**: Profile root (`/profile`) discovers entities, it's not itself an entity profile
- **Single Responsibility**: `ProfileEntity` handles individual entity profiles, not system discovery
- **Avoid confusion**: `ProfileEntity.profileRootQuery()` implies it's about entity profiles (it's not)

**Where things belong:**

- **Standalone functions**: Root resources, system-wide discovery, cross-entity operations
- **Class methods**: Operations specific to that domain model (entity profiles, entity items, etc.)

---

### 6. Request-Based API

**Pattern**: Core fetch functions accept `Request` objects, not URL strings.

```typescript
// ✅ Good: Accepts Request for flexibility
export async function fetchHal<T>(
  apiFetch: TypedFetch,
  request: Request,
): Promise<HalFetchResult<T>> {
  const response = await apiFetch(request);
  // ...
}

// Usage - simple GET
const { object } = await fetchHal(apiFetch, new Request(url));

// Usage - with custom method/headers
const request = new Request(url, {
  method: "POST",
  headers: { "X-Custom": "value" }
});
const { object } = await fetchHal(apiFetch, request);
```

**Rationale:**

HAL-Forms codecs already produce `Request` objects with the correct method, URL, headers, and body. For example, `searchEntity` and `createEntity` encode form values into requests:

```typescript
public async searchEntity(apiFetch: TypedFetch, values: HalFormValues<SearchRequestSpec>) {
  const searchTemplate = this.searchTemplate;
  if (!searchTemplate) {
    throw new Error("No search template available");
  }
  const codec = halFormCodecs.requireCodecFor(searchTemplate.template);
  const request = codec.encode(values); // ← HAL-Forms codec returns a Request
  return apiFetch(request).then(checkResponse);
}
```

By accepting `Request` objects at the lowest level (`fetchHal`, `fetchHalSlice`), we:

- Avoid re-parsing URLs or reconstructing requests
- Support the full spectrum of HTTP operations (GET, POST, PATCH, DELETE)
- Let HAL-Forms codecs control the request details (method, Content-Type, body encoding)
- Maintain consistency across simple GETs and complex form submissions

**Benefits:**

- Support any HTTP method (GET, POST, etc.)
- Custom headers when needed
- Request options (cache, credentials, etc.)
- More flexible than hardcoded `method: "GET"`
- Direct integration with HAL-Forms codecs

**When to create Request:**

- **HAL-Forms operations**: Codecs create Request objects automatically (search, create, update)
- **Simple GETs**: `new Request(url)` (defaults to GET method)
- **Profile fetching**: Always GET, so `new Request(link.href)`
- **Custom operations**: Full control over method, headers, body

---

## Testing Patterns

### Unit Testing Fetch Functions

```typescript
// Layer 1: Pure functions are easy to test
test("getProfileEntity filters by name", async () => {
  const mockFetch = vi.fn().mockResolvedValue(mockResponse);
  const result = await getProfileEntity(mockFetch, profileUrl, { name: "invoice" });
  expect(result?.name).toBe("invoice");
});
```

### Testing Static QueryOptions

```typescript
// Layer 2: Test query configuration
test("profileByLinkQuery has correct defaults", () => {
  const query = ProfileEntity.profileByLinkQuery(mockFetch, mockLink);
  expect(query.staleTime).toBe(5 * 60 * 1000);
  expect(query.gcTime).toBe(10 * 60 * 1000);
  expect(query.retry).toBe(3);
});
```

### Testing Hooks

```typescript
// Layer 3: Test with React Testing Library
test("useProfileEntity auto-injects context", () => {
  const { result } = renderHook(() => useProfileEntity({ name: "invoice" }), {
    wrapper: ({ children }) => (
      <NavigatorDataProvider apiFetch={mockFetch} profileUrl={mockUrl}>
        {children}
      </NavigatorDataProvider>
    ),
  });
  // ...
});
```

---

## Migration Guide

### From Old Pattern to New Pattern

**Before (hooks only):**

```typescript
// Hook file
function profileEntityQuery(apiFetch, profileUrl, filter) {
  return queryOptions({ queryKey: [...], queryFn: ... });
}

export function useProfileEntity(filter) {
  const { apiFetch, profileUrl } = useNavigatorData();
  return useQuery(profileEntityQuery(apiFetch, profileUrl, filter));
}

// Component
const { data } = useProfileEntity({ name: "invoice" });
```

**After (static + hooks):**

```typescript
// Domain class
class ProfileEntity {
  public static entityProfileQuery(apiFetch, profileUrl, filter, override = {}) {
    return queryOptions({
      queryKey: [...],
      queryFn: ...,
      staleTime: PROFILE_STALE_TIME,
      ...override,
    });
  }
}

// Hook file
export function useProfileEntity(filter, options) {
  const { apiFetch, profileUrl } = useNavigatorData();
  return useQuery(
    ProfileEntity.entityProfileQuery(apiFetch, profileUrl, filter, options?.queryOptionsOverride)
  );
}

// Component (same usage!)
const { data } = useProfileEntity({ name: "invoice" });

// Router loader (new capability!)
loader: ({ context }) => {
  const { queryClient, apiFetch, profileUrl } = context;
  return queryClient.ensureQueryData(
    ProfileEntity.entityProfileQuery(apiFetch, profileUrl, { name: "invoice" })
  );
}
```

---

## Summary

The accessor layer follows these core principles:

1. **Three-layer architecture**: Fetch functions → Static queryOptions → React hooks
2. **Co-location**: Query logic lives with domain models
3. **Consistent defaults**: Parametrized configuration (staleTime, gcTime, retry)
4. **Granular queries**: useQueries over Promise.all for better UX
5. **Clear boundaries**: System-level functions vs. domain-specific class methods
6. **Request-based**: Core APIs accept Request objects for flexibility
7. **Type safety**: Full TypeScript inference through all layers
8. **Testability**: Each layer independently testable

These patterns provide a clean, maintainable, and performant data layer for the Navigator application.
