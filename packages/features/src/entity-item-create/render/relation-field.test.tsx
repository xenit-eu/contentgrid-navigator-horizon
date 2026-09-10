import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  type HalFormsProperty,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../../test-setup";
import type { RelationFieldDescriptor } from "./relation-field";
import { RelationField } from "./relation-field";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile/suppliers`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;
const DUMMY_PROPERTY = {} as unknown as HalFormsProperty;

const supplierProfileJson = {
  name: "supplier",
  title: "Supplier",
  description: "",
  _links: {
    self: { href: PROFILE_URL },
    describes: [
      { href: `${API_URL}/suppliers`, name: "collection" },
      { href: `${API_URL}/suppliers/{id}`, name: "item", templated: true },
    ],
  },
  _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
  // A `search` template is required for `useEntityItemCollection`'s default (no-url,
  // no-searchValues) mode to be enabled at all — see resolveCollectionRequest in
  // packages/navigator-data/src/hooks/collection/use-entity-item-collection.ts.
  _templates: {
    search: { method: "GET", target: `${API_URL}/suppliers`, properties: [] },
  },
};

function supplierField(cardinality: "to-one" | "to-many" = "to-one"): RelationFieldDescriptor {
  return {
    name: "supplier",
    label: "Supplier",
    required: false,
    readOnly: false,
    kind: "relation",
    cardinality,
    targetHref: `${API_URL}/suppliers`,
    property: DUMMY_PROPERTY,
  };
}

function collectionHandler(
  items: { id: string; name: string }[],
  opts: { nextHref?: string; prevHref?: string } = {},
) {
  return http.get(`${API_URL}/suppliers`, () =>
    HttpResponse.json({
      _embedded: {
        item: items.map((item) => ({
          ...item,
          _links: { self: { href: `${API_URL}/suppliers/${item.id}` } },
        })),
      },
      _links: {
        self: { href: `${API_URL}/suppliers` },
        ...(opts.nextHref ? { next: { href: opts.nextHref } } : {}),
        ...(opts.prevHref ? { prev: { href: opts.prevHref } } : {}),
      },
    }),
  );
}

function renderRelationField(props: Partial<Parameters<typeof RelationField>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);
  const targetProfile = makeProfileEntity(supplierProfileJson, PROFILE_URL, "supplier");

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={`${API_URL}/profile`}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  const baseProps: Parameters<typeof RelationField>[0] = {
    field: supplierField(),
    targetProfile,
    value: undefined,
    onChange: vi.fn(),
    relationItemsData: {},
    onItemResolved: vi.fn(),
    ...props,
  };

  const result = render(<RelationField {...baseProps} />, { wrapper: Wrapper });
  return {
    ...result,
    // Re-renders with the same `targetProfile`/wrapper, applying prop overrides on top of the
    // original call — used to simulate a controlling parent (like
    // create-entity-item-container.tsx) applying an onChange/onItemResolved call it just observed.
    rerenderWith: (overrides: Partial<Parameters<typeof RelationField>[0]>) =>
      result.rerender(<RelationField {...baseProps} {...overrides} />),
  };
}

describe("RelationField", () => {
  it("renders a to-one picker that links a fetched item", async () => {
    const user = userEvent.setup();
    server.use(collectionHandler([{ id: "1", name: "Acme Corp" }]));
    const onChange = vi.fn();
    const onItemResolved = vi.fn();
    renderRelationField({ onChange, onItemResolved });

    await user.click(await screen.findByRole("button", { name: /link supplier/i }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Acme Corp");
    await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
    await user.click(within(dialog).getByRole("button", { name: "Select" }));

    expect(onChange).toHaveBeenCalledWith(`${API_URL}/suppliers/1`);
    expect(onItemResolved).toHaveBeenCalledWith(`${API_URL}/suppliers/1`, {
      id: "1",
      name: "Acme Corp",
      _links: { self: { href: `${API_URL}/suppliers/1` } },
    });
  });

  it("fires onViewRelationItem with the target profile and the linked item's real id", async () => {
    const user = userEvent.setup();
    server.use(collectionHandler([{ id: "1", name: "Acme Corp" }]));
    const onViewRelationItem = vi.fn();
    const linkedHref = `${API_URL}/suppliers/1`;
    const { rerenderWith } = renderRelationField({ onViewRelationItem });

    await user.click(await screen.findByRole("button", { name: /link supplier/i }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Acme Corp");
    await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
    await user.click(within(dialog).getByRole("button", { name: "Select" }));

    // Simulates the controlling parent (create-entity-item-container.tsx) applying the
    // onChange/onItemResolved call it just observed — RelationField is a controlled component,
    // so the linked item only becomes visible (and its "view details" button rendered) once the
    // caller feeds `value`/`relationItemsData` back in.
    rerenderWith({
      value: linkedHref,
      relationItemsData: { [linkedHref]: { name: "Acme Corp" } },
    });

    await user.click(await screen.findByRole("button", { name: /view details/i }));

    expect(onViewRelationItem).toHaveBeenCalledWith(
      expect.objectContaining({ name: "supplier" }),
      "1",
    );
  });

  it("renders a to-many picker that appends selected items onto the existing value", async () => {
    const user = userEvent.setup();
    server.use(collectionHandler([{ id: "1", name: "Acme Corp" }]));
    const onChange = vi.fn();
    renderRelationField({
      field: supplierField("to-many"),
      value: [`${API_URL}/suppliers/2`],
      onChange,
    });

    await user.click(await screen.findByRole("button", { name: /link supplier/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
    await user.click(within(dialog).getByRole("button", { name: "Link" }));

    expect(onChange).toHaveBeenCalledWith([`${API_URL}/suppliers/2`, `${API_URL}/suppliers/1`]);
  });

  it("paginates the picker via next", async () => {
    const user = userEvent.setup();
    const nextPageUrl = `${API_URL}/suppliers/page2`;
    server.use(
      collectionHandler([{ id: "1", name: "Acme Corp" }], { nextHref: nextPageUrl }),
      http.get(nextPageUrl, () =>
        HttpResponse.json({
          _embedded: {
            item: [
              { id: "2", name: "Globex Inc", _links: { self: { href: `${API_URL}/suppliers/2` } } },
            ],
          },
          _links: { self: { href: nextPageUrl } },
        }),
      ),
    );
    renderRelationField();

    await userEvent.setup().click(await screen.findByRole("button", { name: /link supplier/i }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Acme Corp");

    await user.click(within(dialog).getByRole("button", { name: "Next" }));
    await within(dialog).findByText("Globex Inc");
  });

  it("shows a ProblemAlert when the target collection fails to load", async () => {
    // EntityItemCollection.fetchByUrlQuery hardcodes retry:3 — fake timers required to flush
    // backoff, per packages/navigator-data/CLAUDE.md's query-options-factories note.
    vi.useFakeTimers();
    server.use(
      http.get(`${API_URL}/suppliers`, () =>
        HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/not-found/endpoint",
            title: "Not found",
            status: 404,
          },
          { status: 404, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderRelationField();

    await vi.runAllTimersAsync();
    vi.useRealTimers();

    expect(screen.getByText("Not found")).toBeInTheDocument();
  });
});
