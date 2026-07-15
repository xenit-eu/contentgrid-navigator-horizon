/**
 * Tests for useCreateEntityItem hook.
 *
 * Covers:
 * - Success POST → new EntityItem returned from mutation
 * - Cache: setQueryData on entityItem.byUrl key for the new item's self href
 * - Collection invalidation for the entity type after success
 * - Caller onSuccess runs after cache is already populated
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { HalObject, type Link } from "@contentgrid/hal";
import { createValues } from "@contentgrid/hal-forms/values";
import { invoiceCreateTemplate, invoiceProfileBody } from "../../../test-fixtures/hal/fixtures";
import { server } from "../../../test-setup";
import { EntityItem } from "../../accessors/entity-item";
import ProfileEntity from "../../accessors/entity-profile";
import { queryKeys } from "../../query-keys";
import type { ProfileEntityShape } from "../../shapes";
import { BASE, makeQueryClient, makeWrapper } from "../test-utils";
import { useCreateEntityItem } from "./use-create-entity";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INVOICE_PROFILE_URL = `${BASE}/profile/invoices`;
const INVOICE_COLLECTION_URL = `${BASE}/invoices`;
const NEW_INVOICE_URL = `${INVOICE_COLLECTION_URL}/inv-999`;

function makeInvoiceProfile(): ProfileEntity {
  const profileBody = {
    ...invoiceProfileBody,
    _links: {
      self: { href: INVOICE_PROFILE_URL },
      describes: [
        { href: INVOICE_COLLECTION_URL, name: "collection" },
        { href: `${INVOICE_COLLECTION_URL}/{id}`, name: "item", templated: true },
      ],
    },
    _templates: {
      "create-form": {
        ...invoiceCreateTemplate,
        target: INVOICE_COLLECTION_URL,
      },
    },
  };
  const hal = new HalObject(profileBody as unknown as ProfileEntityShape);
  return new ProfileEntity(
    { href: INVOICE_PROFILE_URL, name: "invoice", title: "Invoice" } as unknown as Link,
    hal as HalObject<ProfileEntityShape>,
  );
}

const createdInvoiceBody = {
  id: "inv-999",
  number: "INV-2024-999",
  date: "2024-05-01",
  total: 500,
  status: "pending",
  customerId: "cust-001",
  _links: { self: { href: NEW_INVOICE_URL } },
};

// `invoiceCreateTemplate` is a raw fixture object, not a resolved HalFormsTemplate
// instance — createValues() requires the latter, so build values off the profile's
// own (resolved) createTemplate.
const createValuesForNewInvoice = (profile: ProfileEntity) =>
  createValues(profile.createTemplate!.template)
    .withValue("number", "INV-2024-999")
    .withValue("date", "2024-05-01")
    .withValue("total", 500)
    .withValue("customerId", "/customers/cust-001");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useCreateEntityItem — success POST", () => {
  it("returns the newly created EntityItem on success", async () => {
    server.use(
      http.post(INVOICE_COLLECTION_URL, () =>
        HttpResponse.json(createdInvoiceBody, { status: 201 }),
      ),
    );

    const profile = makeInvoiceProfile();
    const { result } = renderHook(() => useCreateEntityItem(profile), {
      wrapper: makeWrapper(),
    });

    await act(async () => {
      result.current.mutate(createValuesForNewInvoice(profile));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeInstanceOf(EntityItem);
    expect(result.current.data?.id).toBe("inv-999");
  });
});

describe("useCreateEntityItem — cache behaviour", () => {
  it("sets queryData on entityItem.byUrl key for the new item's self href", async () => {
    server.use(
      http.post(INVOICE_COLLECTION_URL, () =>
        HttpResponse.json(createdInvoiceBody, { status: 201 }),
      ),
    );

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();

    const { result } = renderHook(() => useCreateEntityItem(profile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(createValuesForNewInvoice(profile));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const cached = queryClient.getQueryData(queryKeys.entityItem.byUrl(profile, NEW_INVOICE_URL));
    expect(cached).toBeInstanceOf(EntityItem);
    expect((cached as EntityItem).id).toBe("inv-999");
  });

  it("invalidates entity collection queries for the entity type after success", async () => {
    server.use(
      http.post(INVOICE_COLLECTION_URL, () =>
        HttpResponse.json(createdInvoiceBody, { status: 201 }),
      ),
    );

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateEntityItem(profile), {
      wrapper: makeWrapper(queryClient),
    });

    await act(async () => {
      result.current.mutate(createValuesForNewInvoice(profile));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.entityItemCollection.forEntity(profile),
    });
  });

  it("calls caller onSuccess after cache is already populated", async () => {
    server.use(
      http.post(INVOICE_COLLECTION_URL, () =>
        HttpResponse.json(createdInvoiceBody, { status: 201 }),
      ),
    );

    const queryClient = makeQueryClient();
    const profile = makeInvoiceProfile();

    let cacheAtCallTime: unknown = undefined;
    const callerOnSuccess = vi.fn(async () => {
      cacheAtCallTime = queryClient.getQueryData(
        queryKeys.entityItem.byUrl(profile, NEW_INVOICE_URL),
      );
    });

    const { result } = renderHook(
      () =>
        useCreateEntityItem(profile, {
          mutationOptions: { onSuccess: callerOnSuccess },
        }),
      { wrapper: makeWrapper(queryClient) },
    );

    await act(async () => {
      result.current.mutate(createValuesForNewInvoice(profile));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(callerOnSuccess).toHaveBeenCalledOnce();
    expect(cacheAtCallTime).toBeInstanceOf(EntityItem);
  });
});
