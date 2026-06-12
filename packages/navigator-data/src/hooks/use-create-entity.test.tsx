import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import { server } from "../../test-setup";
import type { EntitySchema } from "../types/entity";
import { queryKeys } from "./query-keys";
import { BASE, makeQueryClient, makeWrapper, seedProfile } from "./test-utils";
import { useCreateEntity } from "./use-create-entity";

const COLLECTION_URL = `${BASE}/invoices`;
const CREATED_URL = `${COLLECTION_URL}/inv-new`;

/** Seed a minimal entity schema cache entry with a create-form template. */
function seedEntitySchema(
  qc: ReturnType<typeof makeQueryClient>,
  overrides: Partial<EntitySchema> = {},
) {
  const schema: EntitySchema = {
    attributes: [],
    relations: [],
    searchProperties: [],
    sortableFields: [],
    sortOptions: [],
    createFormRelations: [],
    createFormTemplate: {
      method: "POST",
      target: null,
      contentType: "application/json",
    },
    ...overrides,
  };
  qc.setQueryData(queryKeys.entitySchema("invoice"), schema);
}

describe("useCreateEntity", () => {
  it("POSTs JSON using method/target from create-form template and returns the Location header", async () => {
    server.use(
      http.post(
        COLLECTION_URL,
        () => new HttpResponse(null, { status: 201, headers: { Location: CREATED_URL } }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntitySchema(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", data: { number: "INV-001" } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(CREATED_URL);
  });

  it("uses a custom target URL from create-form template when provided", async () => {
    const CUSTOM_URL = `${BASE}/invoices?source=api`;
    server.use(
      http.post(
        CUSTOM_URL,
        () => new HttpResponse(null, { status: 201, headers: { Location: CREATED_URL } }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntitySchema(qc, {
      createFormTemplate: { method: "POST", target: CUSTOM_URL, contentType: "application/json" },
    });

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", data: { number: "INV-001" } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(CREATED_URL);
  });

  it("POSTs multipart FormData when a file is provided", async () => {
    let receivedContentType: string | null = null;
    server.use(
      http.post(COLLECTION_URL, ({ request }) => {
        receivedContentType = request.headers.get("Content-Type");
        return new HttpResponse(null, { status: 201, headers: { Location: CREATED_URL } });
      }),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntitySchema(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });
    const file = new File(["content"], "doc.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.mutateAsync({
        entityName: "invoice",
        data: { number: "INV-001" },
        file,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(receivedContentType).toContain("multipart/form-data");
  });

  it("throws when entity is not in profile", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "unknown", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Unknown entity/);
  });

  it("throws when no create-form template is in the schema cache (operation not supported)", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    // Schema seeded without a create-form template
    seedEntitySchema(qc, { createFormTemplate: null });

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Operation not supported/);
    expect((result.current.error as Error).message).toMatch(/"create-form" template/);
  });

  it("throws when the schema cache is absent (no create-form template available)", async () => {
    const qc = makeQueryClient();
    seedProfile(qc);
    // Schema NOT seeded at all

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", data: {} });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toMatch(/Operation not supported/);
  });

  it("invalidates entityList and entityCount queries on success", async () => {
    server.use(
      http.post(
        COLLECTION_URL,
        () => new HttpResponse(null, { status: 201, headers: { Location: CREATED_URL } }),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntitySchema(qc);
    const invalidateSpy = vi.spyOn(qc, "invalidateQueries");

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ entityName: "invoice", data: { number: "INV-001" } });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(["entity-list", "invoice", {}]);
    expect(invalidatedKeys).toContainEqual(["entity-count", "invoice"]);
  });

  it("rejects with an error on a 422 response", async () => {
    server.use(
      http.post(COLLECTION_URL, () =>
        HttpResponse.json(
          { status: 422, title: "Validation failed" },
          { status: 422, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );

    const qc = makeQueryClient();
    seedProfile(qc);
    seedEntitySchema(qc);

    const { result } = renderHook(() => useCreateEntity(), { wrapper: makeWrapper(qc) });

    await act(async () => {
      result.current.mutate({ entityName: "invoice", data: { number: "INV-001" } });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
