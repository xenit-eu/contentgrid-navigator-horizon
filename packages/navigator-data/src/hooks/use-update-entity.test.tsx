/**
 * Tests for useUpdateEntityItem hook.
 *
 * Covers:
 * - Success PATCH → updated EntityItem with new ETag
 * - If-Match header sent verbatim from entityItem.etag
 * - null etag → no If-Match header attached
 * - Cache: setQueryData on entityItem.byUrl key after success
 * - Collection invalidation after success
 * - Caller onSuccess runs after cache is populated
 * - 400 validation error → isError with ProblemDetailError
 * - 412 ETag mismatch → isError, ProblemDetailError status 412, PATCH handler called exactly once (no retry)
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import type { HalObjectShape } from "@contentgrid/hal/shape";
import { type ProblemDetail, ProblemDetailError } from "@contentgrid/problem-details";
import {
  invoiceProfileBody,
  invoiceUpdateTemplate,
  sampleInvoice,
} from "../../test-fixtures/hal/fixtures";
import { server } from "../../test-setup";
import { EntityItem } from "../accessors/entity-item";
import ProfileEntity from "../accessors/entity-profile";
import { queryKeys } from "../query-keys";
import type { EntityItemShape, ProfileEntityShape } from "../shapes";
import { BASE, makeQueryClient, makeWrapper } from "./test-utils";
import { useUpdateEntityItem } from "./use-update-entity";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_ITEM_URL = `${BASE}/invoices/inv-001`;

// Build a ProfileEntity wrapping the invoice profile fixture
function makeInvoiceProfile(): ProfileEntity {
  const profileBody = {
    ...invoiceProfileBody,
    _links: {
      ...invoiceProfileBody._links,
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: `${BASE}/invoices`, name: "collection" },
        { href: `${BASE}/invoices/{id}`, name: "item", templated: true },
      ],
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

// Build an EntityItem with NO default template (ABAC denies update)
function makeEntityItemWithoutTemplate(): EntityItem {
  const profile = makeInvoiceProfile();
  const itemBody = {
    ...sampleInvoice,
    _links: {
      ...sampleInvoice._links,
      self: { href: INVOICE_ITEM_URL },
    },
    // no _templates → defaultTemplate is null
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, null);
}

// Build an EntityItem with a default (update) template and optional etag
function makeEntityItemWithTemplate(etag: string | null = '"v1"'): EntityItem {
  const profile = makeInvoiceProfile();
  const itemBody = {
    ...sampleInvoice,
    _links: {
      ...sampleInvoice._links,
      self: { href: INVOICE_ITEM_URL },
    },
    _templates: {
      default: {
        ...invoiceUpdateTemplate,
        target: INVOICE_ITEM_URL,
      },
    },
  };
  const hal = new HalObject(itemBody as unknown as HalObjectShape<EntityItemShape>);
  return new EntityItem(hal, profile, etag);
}

// Minimal updated invoice body returned after PATCH
const updatedInvoiceBody = {
  ...sampleInvoice,
  status: "paid",
  _links: { self: { href: INVOICE_ITEM_URL } },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useUpdateEntityItem — success PATCH → updated EntityItem with new ETag", () => {
  it("returns updated EntityItem with new ETag on success", async () => {
    server.use(
      http.patch(INVOICE_ITEM_URL, () =>
        HttpResponse.json(updatedInvoiceBody, {
          status: 200,
          headers: { ETag: '"v2"' },
        }),
      ),
    );

    const entityItem = makeEntityItemWithTemplate('"v1"');
    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect(result.current.data?.etag).toBe('"v2"');
  });
});

describe("useUpdateEntityItem — If-Match header", () => {
  it("sends If-Match verbatim from entityItem.etag", async () => {
    let capturedIfMatch: string | null = null;

    server.use(
      http.patch(INVOICE_ITEM_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return HttpResponse.json(updatedInvoiceBody, {
          status: 200,
          headers: { ETag: '"v2"' },
        });
      }),
    );

    const entityItem = makeEntityItemWithTemplate('"v1"');
    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBe('"v1"');
  });

  it("sends no If-Match header when etag is null", async () => {
    let capturedIfMatch: string | null | undefined = undefined;

    server.use(
      http.patch(INVOICE_ITEM_URL, async ({ request }) => {
        capturedIfMatch = request.headers.get("If-Match");
        return HttpResponse.json(updatedInvoiceBody, {
          status: 200,
          headers: { ETag: '"v2"' },
        });
      }),
    );

    const entityItem = makeEntityItemWithTemplate(null);
    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(capturedIfMatch).toBeNull();
  });
});

describe("useUpdateEntityItem — cache behaviour", () => {
  it("sets queryData on entityItem.byUrl key after success", async () => {
    server.use(
      http.patch(INVOICE_ITEM_URL, () =>
        HttpResponse.json(updatedInvoiceBody, {
          status: 200,
          headers: { ETag: '"v2"' },
        }),
      ),
    );

    const queryClient = makeQueryClient();
    const entityItem = makeEntityItemWithTemplate('"v1"');
    const profile = entityItem.profileEntity;

    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL));
    expect(cached).toBeInstanceOf(EntityItem);
    expect((cached as EntityItem).etag).toBe('"v2"');
  });

  it("invalidates entity collection queries after success", async () => {
    server.use(
      http.patch(INVOICE_ITEM_URL, () =>
        HttpResponse.json(updatedInvoiceBody, {
          status: 200,
          headers: { ETag: '"v2"' },
        }),
      ),
    );

    const queryClient = makeQueryClient();
    const entityItem = makeEntityItemWithTemplate('"v1"');
    const profile = entityItem.profileEntity;

    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItemCollection.forEntity(profile),
    });
  });

  it("calls caller onSuccess after cache is already populated", async () => {
    server.use(
      http.patch(INVOICE_ITEM_URL, () =>
        HttpResponse.json(updatedInvoiceBody, {
          status: 200,
          headers: { ETag: '"v2"' },
        }),
      ),
    );

    const queryClient = makeQueryClient();
    const entityItem = makeEntityItemWithTemplate('"v1"');
    const profile = entityItem.profileEntity;

    let cacheAtCallTime: unknown = undefined;
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, INVOICE_ITEM_URL),
      );
    });

    const { result } = renderHook(
      () =>
        useUpdateEntityItem(entityItem, {
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    // Cache must already be set when caller onSuccess runs
    expect(cacheAtCallTime).toBeInstanceOf(EntityItem);
  });
});

describe("useUpdateEntityItem — error handling", () => {
  it("surfaces 400 validation error as ProblemDetailError", async () => {
    server.use(
      http.patch(INVOICE_ITEM_URL, () =>
        HttpResponse.json(
          {
            status: 400,
            title: "Validation Failed",
            type: "https://contentgrid.cloud/problems/input/validation",
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const entityItem = makeEntityItemWithTemplate('"v1"');
    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "invalid" } as any);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
  });

  it("surfaces 412 as ProblemDetailError with status 412 and PATCH handler hit exactly once (no retry)", async () => {
    let patchCallCount = 0;

    server.use(
      http.patch(INVOICE_ITEM_URL, () => {
        patchCallCount++;
        return HttpResponse.json(
          {
            status: 412,
            title: "Precondition Failed",
            type: "https://contentgrid.cloud/problems/unsatisfied-version",
          },
          { status: 412, headers: { "Content-Type": "application/problem+json" } },
        );
      }),
    );

    const entityItem = makeEntityItemWithTemplate('"v1"');
    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ProblemDetailError);
    expect((result.current.error as ProblemDetailError<ProblemDetail>).problemDetail.status).toBe(
      412,
    );
    // No retry — PATCH handler called exactly once
    expect(patchCallCount).toBe(1);
  });
});

describe("useUpdateEntityItem — ABAC absent template", () => {
  it("surfaces an error when the default template is absent (ABAC denies update)", async () => {
    const entityItem = makeEntityItemWithoutTemplate();
    const { result } = renderHook(() => useUpdateEntityItem(entityItem), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.mutate({ status: "paid" } as any);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(Error);
    expect((result.current.error as Error).message).toBe(
      "Update not permitted: 'default' template absent",
    );
  });
});
