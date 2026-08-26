import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { server } from "../../test-setup";
import { CreateEntityItemForm } from "./create-entity-item-form";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function profileRootHandler(withSupplier = false) {
  return http.get(PROFILE_URL, () =>
    HttpResponse.json({
      _links: {
        self: { href: PROFILE_URL },
        curies: [
          { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
        ],
        "cg:entity": [
          { href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" },
          ...(withSupplier
            ? [{ href: `${PROFILE_URL}/suppliers`, name: "supplier", title: "Supplier" }]
            : []),
        ],
      },
    }),
  );
}

function invoiceProfileHandler(
  createForm: Record<string, unknown> | null = DEFAULT_CREATE_FORM,
  relations: Record<string, unknown>[] = [],
) {
  return http.get(`${PROFILE_URL}/invoices`, () =>
    HttpResponse.json({
      name: "invoice",
      title: "Invoice",
      _links: {
        self: { href: `${PROFILE_URL}/invoices` },
        describes: [
          { href: `${API_URL}/invoices`, name: "collection" },
          { href: `${API_URL}/invoices/{id}`, name: "item", templated: true },
        ],
        curies: [
          {
            href: "https://contentgrid.cloud/rels/blueprint/{rel}",
            name: "blueprint",
            templated: true,
          },
        ],
      },
      _embedded: { "blueprint:attribute": [], "blueprint:relation": relations },
      _templates: createForm ? { "create-form": createForm } : {},
    }),
  );
}

const DEFAULT_CREATE_FORM = {
  method: "POST",
  target: `${API_URL}/invoices`,
  contentType: "application/json",
  properties: [
    { name: "invoice_number", type: "text", required: true },
    { name: "is_recurring", type: "checkbox" },
  ],
};

const SUPPLIER_RELATION = {
  name: "supplier",
  title: "Supplier",
  description: "",
  many_source_per_target: true,
  many_target_per_source: false,
  required: false,
  _links: { "blueprint:target-entity": { href: `${PROFILE_URL}/suppliers` } },
};

const CREATE_FORM_WITH_SUPPLIER = {
  ...DEFAULT_CREATE_FORM,
  properties: [
    ...DEFAULT_CREATE_FORM.properties,
    {
      name: "supplier",
      type: "url",
      options: {
        link: { href: `${API_URL}/suppliers`, title: "Suppliers" },
        maxItems: 1,
        valueField: "/_links/self/href",
      },
    },
  ],
};

function supplierProfileHandler() {
  return http.get(`${PROFILE_URL}/suppliers`, () =>
    HttpResponse.json({
      name: "supplier",
      title: "Supplier",
      _links: {
        self: { href: `${PROFILE_URL}/suppliers` },
        describes: [
          { href: `${API_URL}/suppliers`, name: "collection" },
          { href: `${API_URL}/suppliers/{id}`, name: "item", templated: true },
        ],
      },
      _embedded: {
        "blueprint:attribute": [
          { name: "name", title: "Name", type: "string", required: false },
          { name: "city", title: "City", type: "string", required: false },
        ],
        "blueprint:relation": [],
      },
      _templates: {
        default: { method: "HEAD", target: `${API_URL}/suppliers`, properties: [] },
        search: { method: "GET", target: `${API_URL}/suppliers`, properties: [] },
      },
    }),
  );
}

function supplierCollectionHandler(
  items: { id: string; name: string; city?: string }[],
  opts: { nextHref?: string } = {},
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
      },
    }),
  );
}

function Harness({
  onCreated,
  onCancel,
  onDirtyChange,
}: Readonly<{
  onCreated?: (item: { id: string }) => void;
  onCancel?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}>) {
  const { data: profile } = useProfileEntity({ name: "invoice" });
  if (!profile) return <p>Loading…</p>;
  return (
    <CreateEntityItemForm
      profile={profile}
      onCreated={onCreated}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  );
}

function renderForm(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const apiFetch = createApiClient(noopSupplier);
  const contentFetch = createContentClient(noopSupplier);

  function Wrapper({ children }: { children: ReactNode }) {
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
  }

  return render(<Harness {...props} />, { wrapper: Wrapper });
}

describe("CreateEntityItemForm", () => {
  it("renders one field per create-form property", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler());
    renderForm();

    expect(await screen.findByLabelText(/Invoice Number/)).toBeInTheDocument();
    expect(screen.getByLabelText("Is Recurring")).toBeInTheDocument();
  });

  it("shows a not-permitted message when the profile has no create-form template", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(null));
    renderForm();

    expect(await screen.findByText(/not permitted/)).toBeInTheDocument();
  });

  it("blocks submission and shows a client error when a required field is empty", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler());
    renderForm();

    await screen.findByLabelText(/Invoice Number/);
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Invoice Number is required")).toBeInTheDocument();
  });

  it("submits the entered values and calls onCreated on success", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.post(`${API_URL}/invoices`, () =>
        HttpResponse.json(
          {
            invoice_number: "INV-1",
            _links: { self: { href: `${API_URL}/invoices/1` } },
          },
          { status: 201 },
        ),
      ),
    );
    renderForm({ onCreated });

    const input = await screen.findByLabelText(/Invoice Number/);
    await user.type(input, "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it("reports dirty state via onDirtyChange as the user edits and after a successful create", async () => {
    // This form has no router/navigation-guard knowledge of its own (see
    // packages/features/src/unsaved-changes-guard) — a caller that wants to warn on
    // navigating away with unsaved changes tracks this signal itself.
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.post(`${API_URL}/invoices`, () =>
        HttpResponse.json(
          { invoice_number: "INV-1", _links: { self: { href: `${API_URL}/invoices/1` } } },
          { status: 201 },
        ),
      ),
    );
    renderForm({ onDirtyChange });

    const input = await screen.findByLabelText(/Invoice Number/);
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);

    await user.type(input, "INV-1");
    await vi.waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));

    await user.click(screen.getByRole("button", { name: "Create" }));
    await vi.waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });

  it("maps a server-side validation error onto the offending field", async () => {
    const user = userEvent.setup();
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.post(`${API_URL}/invoices`, () =>
        HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/input/validation",
            title: "Validation failed",
            status: 400,
            errors: [
              {
                type: "https://contentgrid.cloud/problems/input/validation/duplicate",
                title: "Already in use",
                field: "invoice_number",
                conflicting_item: `${API_URL}/invoices/existing`,
              },
            ],
          },
          { status: 400, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderForm();

    const input = await screen.findByLabelText(/Invoice Number/);
    await user.type(input, "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Already in use")).toBeInTheDocument();
  });

  describe("relation fields", () => {
    function setupSupplierRelation(
      items: { id: string; name: string; city?: string }[] = [
        { id: "1", name: "Acme Corp", city: "Amsterdam" },
      ],
    ) {
      server.use(
        profileRootHandler(true),
        invoiceProfileHandler(CREATE_FORM_WITH_SUPPLIER, [SUPPLIER_RELATION]),
        supplierProfileHandler(),
        supplierCollectionHandler(items),
      );
    }

    it("links a supplier via the picker and shows its full attribute data, not just a label", async () => {
      const user = userEvent.setup();
      setupSupplierRelation();
      renderForm();

      const linkButton = await screen.findByRole("button", { name: /link supplier/i });
      await user.click(linkButton);

      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
      await user.click(within(dialog).getByRole("button", { name: "Select" }));

      expect(await screen.findByText("Acme Corp")).toBeInTheDocument();
      expect(await screen.findByText(/Amsterdam/)).toBeInTheDocument();
    });

    it("unlinks a supplier back to no selection", async () => {
      const user = userEvent.setup();
      setupSupplierRelation();
      renderForm();

      await user.click(await screen.findByRole("button", { name: /link supplier/i }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
      await user.click(within(dialog).getByRole("button", { name: "Select" }));
      await screen.findByText("Acme Corp");

      await user.click(screen.getByRole("button", { name: /unlink/i }));
      await user.click(screen.getByRole("button", { name: "Unlink" }));

      expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
      expect(await screen.findByRole("button", { name: /link supplier/i })).toBeInTheDocument();
    });

    it("submits the linked supplier as a bare href", async () => {
      const user = userEvent.setup();
      setupSupplierRelation();
      let capturedBody: string | undefined;
      server.use(
        http.post(`${API_URL}/invoices`, async ({ request }) => {
          capturedBody = await request.text();
          return HttpResponse.json(
            { invoice_number: "INV-1", _links: { self: { href: `${API_URL}/invoices/1` } } },
            { status: 201 },
          );
        }),
      );
      renderForm();

      const input = await screen.findByLabelText(/Invoice Number/);
      await user.type(input, "INV-1");

      await user.click(await screen.findByRole("button", { name: /link supplier/i }));
      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByText("Acme Corp").closest("tr")!);
      await user.click(within(dialog).getByRole("button", { name: "Select" }));
      await screen.findByText("Acme Corp");

      await user.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => expect(capturedBody).toContain(`${API_URL}/suppliers/1`));
    });

    it("paginates the picker via next/previous", async () => {
      const user = userEvent.setup();
      const nextPageUrl = `${API_URL}/suppliers/page2`;
      server.use(
        profileRootHandler(true),
        invoiceProfileHandler(CREATE_FORM_WITH_SUPPLIER, [SUPPLIER_RELATION]),
        supplierProfileHandler(),
        supplierCollectionHandler([{ id: "1", name: "Acme Corp" }], { nextHref: nextPageUrl }),
        http.get(nextPageUrl, () =>
          HttpResponse.json({
            _embedded: {
              item: [
                {
                  id: "2",
                  name: "Globex Inc",
                  _links: { self: { href: `${API_URL}/suppliers/2` } },
                },
              ],
            },
            _links: { self: { href: nextPageUrl } },
          }),
        ),
      );
      renderForm();

      await user.click(await screen.findByRole("button", { name: /link supplier/i }));
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByText("Acme Corp");

      await user.click(within(dialog).getByRole("button", { name: "Next" }));
      await within(dialog).findByText("Globex Inc");
    });
  });
});
