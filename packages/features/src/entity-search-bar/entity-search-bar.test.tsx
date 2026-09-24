import { type ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  type ProfileEntity,
  createApiClient,
  createContentClient,
} from "@contentgrid/navigator-data";
import { makeProfileEntity } from "@contentgrid/navigator-data/test-fixtures/hal/profile-entity";
import { server } from "../../test-setup";
import { useEntityDisplayPreferencesStore } from "../preferences";
import { EntitySearchBar, type EntitySearchBarProps } from "./entity-search-bar";

/**
 * `query`/`onQueryChange` are controlled by the caller (T019 lifts this state to the route, for
 * URL persistence) — this test harness owns that state itself, standing in for the route so
 * every existing test can keep exercising the same end-to-end typing/selection behavior.
 */
function TestSearchBar(props: Omit<EntitySearchBarProps, "query" | "onQueryChange">) {
  const [query, setQuery] = useState("");
  return <EntitySearchBar {...props} query={query} onQueryChange={setQuery} />;
}

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile/items`;
const COLLECTION_URL = `${API_URL}/items`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function makeAttribute(name: string, searchParam?: { name: string; type: string }) {
  return {
    name,
    title: name,
    type: "string",
    description: "",
    readOnly: false,
    required: false,
    _embedded: {
      "blueprint:constraint": [],
      "blueprint:search-param": searchParam ? [{ ...searchParam, title: name }] : [],
      "blueprint:attribute": [],
    },
    _links: {},
  };
}

const searchableItemProfileJson = {
  name: "item",
  title: "Item",
  description: "",
  _embedded: {
    "blueprint:attribute": [makeAttribute("title", { name: "title~prefix", type: "prefix-match" })],
    "blueprint:relation": [],
  },
  _links: {
    self: { href: PROFILE_URL, title: "Item" },
    describes: [
      { href: COLLECTION_URL, name: "collection" },
      { href: `${COLLECTION_URL}/{id}`, name: "item", templated: true },
    ],
    curies: [
      {
        href: "https://contentgrid.cloud/rels/blueprint/{rel}",
        name: "blueprint",
        templated: true,
      },
    ],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [{ name: "title~prefix", type: "text" }],
    },
  },
};

const withEnumProfileJson = {
  ...searchableItemProfileJson,
  _embedded: {
    "blueprint:attribute": [
      makeAttribute("title", { name: "title~prefix", type: "prefix-match" }),
      makeAttribute("status", { name: "status", type: "exact-match" }),
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "title~prefix", type: "text" },
        {
          name: "status",
          type: "text",
          options: { minItems: 0, inline: ["draft", "published", "archived"] },
        },
      ],
    },
  },
};

function makeProfileWithEnum(): ProfileEntity {
  return makeProfileEntity(withEnumProfileJson, PROFILE_URL, "item");
}

const withDateProfileJson = {
  ...searchableItemProfileJson,
  _embedded: {
    "blueprint:attribute": [
      makeAttribute("title", { name: "title~prefix", type: "prefix-match" }),
      {
        name: "created_date",
        title: "Created",
        type: "datetime",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "created_date~from", title: "Created from", type: "greater-than-or-equal" },
            { name: "created_date~until", title: "Created until", type: "less-than-or-equal" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "title~prefix", type: "text" },
        { name: "created_date~from", type: "datetime" },
        { name: "created_date~until", type: "datetime" },
      ],
    },
  },
};

function makeProfileWithDate(): ProfileEntity {
  return makeProfileEntity(withDateProfileJson, PROFILE_URL, "item");
}

const withDateOnlyProfileJson = {
  ...searchableItemProfileJson,
  _embedded: {
    "blueprint:attribute": [
      makeAttribute("title", { name: "title~prefix", type: "prefix-match" }),
      {
        name: "due_date",
        title: "Due",
        type: "date",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [
            { name: "due_date~from", title: "Due from", type: "greater-than-or-equal" },
            { name: "due_date~until", title: "Due until", type: "less-than-or-equal" },
          ],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "title~prefix", type: "text" },
        { name: "due_date~from", type: "date" },
        { name: "due_date~until", type: "date" },
      ],
    },
  },
};

function makeProfileWithDateOnly(): ProfileEntity {
  return makeProfileEntity(withDateOnlyProfileJson, PROFILE_URL, "item");
}

const withRelationSearchProfileJson = {
  ...searchableItemProfileJson,
  _embedded: {
    "blueprint:attribute": [makeAttribute("title", { name: "title~prefix", type: "prefix-match" })],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      properties: [
        { name: "title~prefix", type: "text" },
        // A dot in the property name is what makes this a relation-traversal property
        // (`isOverRelation`, `search-form.ts`) — no working "vendor" relation/profile needs to
        // be resolvable for the toggle's mere presence, only for actually fetching suggestions.
        { name: "vendor.name~prefix", type: "text" },
      ],
    },
  },
};

function makeProfileWithRelationSearch(): ProfileEntity {
  return makeProfileEntity(withRelationSearchProfileJson, PROFILE_URL, "item");
}

const withBooleanProfileJson = {
  ...searchableItemProfileJson,
  _embedded: {
    "blueprint:attribute": [
      makeAttribute("title", { name: "title~prefix", type: "prefix-match" }),
      {
        name: "active",
        title: "Active",
        type: "boolean",
        description: "",
        readOnly: false,
        required: false,
        _embedded: {
          "blueprint:constraint": [],
          "blueprint:search-param": [{ name: "active", title: "Active", type: "exact-match" }],
          "blueprint:attribute": [],
        },
        _links: {},
      },
    ],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
    search: {
      method: "GET",
      target: COLLECTION_URL,
      // "checkbox" is the HAL-FORMS wire type for a boolean property (resolveHalFormsFields
      // maps it to the "boolean" field kind) — a bare name, no directional suffix.
      properties: [
        { name: "title~prefix", type: "text" },
        { name: "active", type: "checkbox" },
      ],
    },
  },
};

function makeProfileWithBoolean(): ProfileEntity {
  return makeProfileEntity(withBooleanProfileJson, PROFILE_URL, "item");
}

const nonSearchableItemProfileJson = {
  ...searchableItemProfileJson,
  _embedded: {
    "blueprint:attribute": [makeAttribute("title")],
    "blueprint:relation": [],
  },
  _templates: {
    default: { method: "HEAD", target: COLLECTION_URL, properties: [] },
  },
};

function makeSearchableProfile(): ProfileEntity {
  return makeProfileEntity(searchableItemProfileJson, PROFILE_URL, "item");
}

function makeNonSearchableProfile(): ProfileEntity {
  return makeProfileEntity(nonSearchableItemProfileJson, PROFILE_URL, "item");
}

function mockCollection(items: Record<string, unknown>[]) {
  server.use(
    http.get(COLLECTION_URL, () =>
      HttpResponse.json({
        _embedded: {
          item: items.map((d, i) => ({
            ...d,
            _links: { self: { href: `${COLLECTION_URL}/${i}` } },
          })),
        },
        _links: { self: { href: COLLECTION_URL } },
      }),
    ),
  );
}

/** Responds with a different item set per exact `title~prefix` value — lets a test simulate the
 * suggestion list actually narrowing/growing as the user types more characters (FR-009), rather
 * than every keystroke returning the same fixed response. */
function mockCollectionByQuery(byQuery: Record<string, Record<string, unknown>[]>) {
  server.use(
    http.get(COLLECTION_URL, ({ request }) => {
      const q = new URL(request.url).searchParams.get("title~prefix") ?? "";
      const items = byQuery[q] ?? [];
      return HttpResponse.json({
        _embedded: {
          item: items.map((d, i) => ({
            ...d,
            _links: { self: { href: `${COLLECTION_URL}/${i}` } },
          })),
        },
        _links: { self: { href: COLLECTION_URL } },
      });
    }),
  );
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NavigatorDataProvider
          apiFetch={apiFetch}
          contentFetch={contentFetch}
          profileUrl={PROFILE_URL}
        >
          {children}
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  };
}

afterEach(() => {
  useEntityDisplayPreferencesStore.setState({ overrides: {} });
});

describe("EntitySearchBar", () => {
  it("renders nothing for an entity with no text-searchable attribute", () => {
    const { container } = render(
      <TestSearchBar
        profile={makeNonSearchableProfile()}
        filters={{}}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a search input for an entity with a text-searchable attribute", () => {
    render(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{}}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("applies a selected search-term suggestion as a filter and shows it in the box", async () => {
    mockCollection([{ id: "1", title: "Acme Corp" }]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "Ac");

    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2));
    await user.click(screen.getAllByRole("button")[0]);

    expect(onFiltersChange).toHaveBeenCalledWith({ "title~prefix": "Acme Corp" });
    expect(input).toHaveValue("Acme Corp");
  });

  it("clearing the box after a selection removes the filter it applied", async () => {
    mockCollection([{ id: "1", title: "Acme Corp" }]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "Ac");
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2));
    await user.click(screen.getAllByRole("button")[0]);
    onFiltersChange.mockClear();

    fireEvent.change(input, { target: { value: "" } });

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it("navigates on effective-match selection", async () => {
    mockCollection([{ id: "1", title: "Acme Corp" }]);
    const onEntityItemSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{}}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={onEntityItemSelect}
      />,
      { wrapper: makeWrapper() },
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "Ac");

    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2));
    const rows = screen.getAllByRole("button");
    await user.click(rows[1]);

    expect(onEntityItemSelect).toHaveBeenCalledOnce();
    expect(onEntityItemSelect.mock.calls[0][0].id).toBe("1");
  });

  it("applies the top suggestion directly on Enter without an explicit pick (FR-012)", async () => {
    mockCollection([{ id: "1", title: "Acme Corp" }]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "Ac");
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2));
    await user.keyboard("{Enter}");

    expect(onFiltersChange).toHaveBeenCalledWith({ "title~prefix": "Acme Corp" });
  });

  it("updates the suggestion list live as the query narrows, and does not change while idle (FR-009)", async () => {
    const bothItems = [
      { id: "1", title: "Acme Corp" },
      { id: "2", title: "Acme Industries" },
    ];
    mockCollectionByQuery({
      A: bothItems,
      Ac: bothItems,
      Acm: bothItems,
      Acme: bothItems,
      "Acme ": bothItems,
      "Acme C": [{ id: "1", title: "Acme Corp" }],
    });
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "Acme");
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(4)); // 2 suggestions + 2 matches

    await user.type(input, " C");
    await waitFor(() => expect(screen.getAllByRole("button")).toHaveLength(2)); // narrowed to 1 suggestion + 1 match

    const narrowedRows = screen.getAllByRole("button").map((r) => r.textContent);

    // Idle: re-render with an unrelated prop change (no further typing) — the list must stay
    // exactly as it was, not reorder or refetch on its own.
    rerender(
      <TestSearchBar
        profile={makeSearchableProfile()}
        filters={{ unrelated: "x" }}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button").map((r) => r.textContent)).toEqual(narrowedRows);
  });

  it("suggests a constrained field's matching allowed values instantly, before any network response can arrive (FR-019)", async () => {
    mockCollection([]); // the entity's OTHER (title~prefix) property still fires a real request
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithEnum()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    const input = screen.getByRole("combobox");
    await user.type(input, "dra");

    // Synchronous — no waitFor/findBy: the enum suggestion is computed from already-known
    // inline options during render, not from a network response that hasn't resolved yet.
    const option = screen.getByText("draft", { exact: false });
    await user.click(option);

    expect(onFiltersChange).toHaveBeenCalledWith({ status: "draft" });
  });

  it("applies a relative date preset to the matching attribute's ~from/~until bounds (FR-021/023)", async () => {
    mockCollection([]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithDate()}
        filters={{ unrelated: "x" }}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await user.click(await screen.findByText("Last week"));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onFiltersChange).toHaveBeenCalledOnce();
    const applied = onFiltersChange.mock.calls[0][0];
    expect(applied.unrelated).toBe("x"); // other filters untouched (FR-023)
    expect(applied["created_date~from"]).toBeTypeOf("string");
    expect(applied["created_date~until"]).toBeTypeOf("string");
    expect(new Date(applied["created_date~from"]).getTime()).toBeLessThan(
      new Date(applied["created_date~until"]).getTime(),
    );
  });

  it("shows a distinct border on the date chip when its ~from/~until filters are both already applied", async () => {
    mockCollection([]);
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithDate()}
        filters={{
          "created_date~from": "2026-09-01T00:00:00.000Z",
          "created_date~until": "2026-09-23T00:00:00.000Z",
        }}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Created")).toHaveClass("border-blue-500");
  });

  it("does not show the active-range border when only one side of the filter is applied", async () => {
    mockCollection([]);
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithDate()}
        filters={{ "created_date~from": "2026-09-01T00:00:00.000Z" }}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Created")).not.toHaveClass("border-blue-500");
  });

  it("removes the attribute's already-applied ~from/~until filters when Clear is clicked (FR-023)", async () => {
    mockCollection([]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithDate()}
        filters={{
          unrelated: "x",
          "created_date~from": "2026-09-01T00:00:00.000Z",
          "created_date~until": "2026-09-23T00:00:00.000Z",
        }}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Created"));
    await user.click(await screen.findByRole("button", { name: "Clear" }));

    expect(onFiltersChange).toHaveBeenCalledWith({ unrelated: "x" });
  });

  it("encodes a date-only attribute's picked range as plain YYYY-MM-DD, not a full ISO datetime", async () => {
    mockCollection([]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithDateOnly()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Due"));
    await user.click(await screen.findByText("Last week"));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect(onFiltersChange).toHaveBeenCalledOnce();
    const applied = onFiltersChange.mock.calls[0][0];
    expect(applied["due_date~from"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(applied["due_date~until"]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("does not show the relation-search toggle for an entity with no relation-traversal search property", async () => {
    mockCollection([]);
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithDate()}
        filters={{}}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    await screen.findByText("Created");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows the relation-search toggle, off by default, for an entity with a relation-traversal search property", async () => {
    mockCollection([]);
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithRelationSearch()}
        filters={{}}
        onFiltersChange={vi.fn()}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    const toggle = await screen.findByRole("switch");
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
  });

  it('sets the boolean attribute\'s exact-match filter to "true" on the first click of its quick-select chip', async () => {
    mockCollection([]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithBoolean()}
        filters={{}}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");
    await user.click(chip);

    expect(onFiltersChange).toHaveBeenCalledWith({ active: "true" });
  });

  it("removes the boolean attribute's filter when its quick-select chip is cycled from false back to unset", async () => {
    mockCollection([]);
    const onFiltersChange = vi.fn();
    const user = userEvent.setup();

    render(
      <TestSearchBar
        profile={makeProfileWithBoolean()}
        filters={{ unrelated: "x", active: "false" }}
        onFiltersChange={onFiltersChange}
        onEntityItemSelect={vi.fn()}
      />,
      { wrapper: makeWrapper() },
    );

    await user.click(screen.getByRole("combobox"));
    const chip = await screen.findByText("Active");
    await user.click(chip);

    expect(onFiltersChange).toHaveBeenCalledWith({ unrelated: "x" });
  });
});
