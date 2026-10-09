import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AuthenticationTokenSupplier,
  NavigatorDataProvider,
  createApiClient,
  createContentClient,
  useProfileEntity,
} from "@contentgrid/navigator-data";
import { Toaster } from "@contentgrid/ui";
import { server } from "../../test-setup";
import { CreateEntityItemContainer } from "./create-entity-item-container";
import { useCreateEntityItemState } from "./state/create-entity-item-state";

const API_URL = "https://api.example.com";
const PROFILE_URL = `${API_URL}/profile`;

const noopSupplier: AuthenticationTokenSupplier = async () => null;

function profileRootHandler() {
  return http.get(PROFILE_URL, () =>
    HttpResponse.json({
      _links: {
        self: { href: PROFILE_URL },
        curies: [
          { name: "cg", href: "https://contentgrid.cloud/rels/contentgrid/{rel}", templated: true },
        ],
        "cg:entity": [{ href: `${PROFILE_URL}/invoices`, name: "invoice", title: "Invoice" }],
      },
    }),
  );
}

function invoiceProfileHandler(createForm: Record<string, unknown> | null = DEFAULT_CREATE_FORM) {
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
      _embedded: { "blueprint:attribute": [], "blueprint:relation": [] },
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

/** MSW handler for a successful create POST. `extra` merges into the response body — e.g. an
 * `status` value for a test exercising the allowed-values field. */
function createdInvoiceHandler(extra: Record<string, unknown> = {}) {
  return http.post(`${API_URL}/invoices`, () =>
    HttpResponse.json(
      {
        id: "1",
        invoice_number: "INV-1",
        _links: { self: { href: `${API_URL}/invoices/1` } },
        ...extra,
      },
      { status: 201 },
    ),
  );
}

function LoadInvoiceProfileAndRenderCreateForm({
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
    <CreateEntityItemContainer
      profile={profile}
      onCreated={onCreated}
      onCancel={onCancel}
      onDirtyChange={onDirtyChange}
    />
  );
}

function renderForm(props: Parameters<typeof LoadInvoiceProfileAndRenderCreateForm>[0] = {}) {
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
          <Toaster />
        </NavigatorDataProvider>
      </QueryClientProvider>
    );
  }

  return render(<LoadInvoiceProfileAndRenderCreateForm {...props} />, { wrapper: Wrapper });
}

describe("CreateEntityItemContainer", () => {
  // The continuous-create toggle is persisted in sessionStorage (see
  // create-entity-item-container.tsx's CONTINUOUS_CREATE_KEY) — clear it between tests so one
  // test's toggle state can't leak into the next.
  afterEach(() => {
    window.sessionStorage.clear();
    useCreateEntityItemState.getState().setInitialFile(null);
  });

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

  it("shows a required field's error on blur, before any submit attempt", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler());
    renderForm();

    const input = await screen.findByLabelText(/Invoice Number/);
    expect(screen.queryByText("Invoice Number is required")).not.toBeInTheDocument();

    await user.click(input);
    await user.tab();

    expect(await screen.findByText("Invoice Number is required")).toBeInTheDocument();
  });

  it("submits the entered values and calls onCreated on success", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    server.use(profileRootHandler(), invoiceProfileHandler(), createdInvoiceHandler());
    renderForm({ onCreated });

    const input = await screen.findByLabelText(/Invoice Number/);
    await user.type(input, "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
  });

  it("defaults the continuous-create toggle to unchecked, and persists it across a remount via sessionStorage", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler());
    const { unmount } = renderForm();

    const toggle = await screen.findByRole("switch", { name: "Keep creating entities" });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);
    expect(toggle).toBeChecked();
    unmount();

    server.use(profileRootHandler(), invoiceProfileHandler());
    renderForm();
    expect(await screen.findByRole("switch", { name: "Keep creating entities" })).toBeChecked();
  });

  it("with continuous-create on, resets the form and shows a toast instead of calling onCreated", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    server.use(profileRootHandler(), invoiceProfileHandler(), createdInvoiceHandler());
    renderForm({ onCreated });

    await user.click(await screen.findByRole("switch", { name: "Keep creating entities" }));

    const input = screen.getByLabelText(/Invoice Number/);
    await user.type(input, "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Invoice has been successfully created!")).toBeInTheDocument();
    await vi.waitFor(() => expect(input).toHaveValue(""));
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("with continuous-create on, moves focus back to the first field after a reset", async () => {
    // Guards create-entity-item-form.tsx's `formResetCount` effect: it looks the first field up
    // through `fieldsContainerRef`, so if the ref ever stops being attached, focus silently stays
    // on the Create button instead.
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), createdInvoiceHandler());
    renderForm();

    await user.click(await screen.findByRole("switch", { name: "Keep creating entities" }));

    const input = screen.getByLabelText(/Invoice Number/);
    await user.type(input, "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await screen.findByText("Invoice has been successfully created!");
    await vi.waitFor(() => expect(input).toHaveFocus());
  });

  it("navigates to the created item via the success toast's action, even mid continuous-create", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    server.use(profileRootHandler(), invoiceProfileHandler(), createdInvoiceHandler());
    renderForm({ onCreated });

    await user.click(await screen.findByRole("switch", { name: "Keep creating entities" }));
    await user.type(screen.getByLabelText(/Invoice Number/), "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("Invoice has been successfully created!");

    await user.click(screen.getByRole("button", { name: "View" }));

    expect(onCreated).toHaveBeenCalledTimes(1);
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("omits the toast's action when the caller supplies no onCreated to navigate with", async () => {
    const user = userEvent.setup();
    server.use(profileRootHandler(), invoiceProfileHandler(), createdInvoiceHandler());
    renderForm();

    await user.type(await screen.findByLabelText(/Invoice Number/), "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Invoice has been successfully created!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
  });

  it("resets an allowed-values field's select display after a continuous-create reset", async () => {
    // End-to-end coverage (real create-form pipeline, not just the isolated EnumRenderer unit
    // test) for a regression where the trigger kept showing the previously selected option
    // after the form reset — see enum-renderer.tsx's `selected` doc comment. The allowed-values
    // field is listed FIRST so the reset's auto-refocus (create-entity-item-form.tsx's
    // `formResetCount` effect, which focuses the first focusable field) lands on the Select's
    // own trigger, not some unrelated field.
    const user = userEvent.setup();
    server.use(
      profileRootHandler(),
      invoiceProfileHandler({
        method: "POST",
        target: `${API_URL}/invoices`,
        contentType: "application/json",
        properties: [
          { name: "status", type: "text", options: { maxItems: 1, inline: ["draft", "sent"] } },
          { name: "invoice_number", type: "text", required: true },
        ],
      }),
      createdInvoiceHandler({ status: "draft" }),
    );
    renderForm();

    await user.click(await screen.findByRole("switch", { name: "Keep creating entities" }));

    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    await user.click(statusTrigger);
    await user.click(await screen.findByRole("option", { name: "draft" }));
    expect(statusTrigger).toHaveTextContent("draft");

    await user.type(screen.getByLabelText(/Invoice Number/), "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));
    await screen.findByText("Invoice has been successfully created!");

    await vi.waitFor(() => expect(screen.getByLabelText(/Invoice Number/)).toHaveValue(""));
    expect(statusTrigger).toHaveTextContent("Select…");
  });

  it("reports dirty state via onDirtyChange as the user edits and after a successful create", async () => {
    // This form has no router/navigation-guard knowledge of its own (see
    // packages/features/src/unsaved-changes-guard) — a caller that wants to warn on
    // navigating away with unsaved changes tracks this signal itself.
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    server.use(profileRootHandler(), invoiceProfileHandler(), createdInvoiceHandler());
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

  it("shows the non-field alert for a field error whose field this form doesn't render", async () => {
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
                type: "https://contentgrid.cloud/problems/input/validation",
                title: "Mandatory field",
                detail: "This field is required",
                field: "supplier",
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

    // "supplier" isn't one of this create-form's rendered fields (see DEFAULT_CREATE_FORM) — with
    // no inline field to show it against, it must still surface via the alert rather than being
    // silently dropped.
    expect(await screen.findByText(/This field is required/)).toBeInTheDocument();
  });

  it("clears a stale server error alert when a resubmit is blocked by client-side validation", async () => {
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
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();

    // Clearing the required field blocks the resubmit client-side, before the mutation ever
    // fires again — the alert from the LAST server round-trip must not linger alongside the new,
    // unrelated client-side "required" error.
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.queryByText("Validation failed")).not.toBeInTheDocument();
    expect(await screen.findByText("Invoice Number is required")).toBeInTheDocument();
  });

  describe("file field", () => {
    const FILE_CREATE_FORM = {
      method: "POST",
      target: `${API_URL}/invoices`,
      contentType: "multipart/form-data",
      properties: [
        { name: "invoice_number", type: "text", required: true },
        { name: "document", type: "file" },
      ],
    };

    async function fillAndPickFile(user: ReturnType<typeof userEvent.setup>) {
      await user.type(await screen.findByLabelText(/Invoice Number/), "INV-1");
      const input = document.querySelector<HTMLInputElement>('input[type="file"]');
      await user.upload(input!, new File(["%PDF"], "invoice.pdf", { type: "application/pdf" }));
    }

    it("sends the picked file in the multipart create request", async () => {
      const user = userEvent.setup();
      let body: string | undefined;
      server.use(
        profileRootHandler(),
        invoiceProfileHandler(FILE_CREATE_FORM),
        http.post(`${API_URL}/invoices`, async ({ request }) => {
          // Read as text: `request.formData()` rebuilds file parts with the global `File`, which
          // jsdom replaces with one undici's parser rejects.
          body = await request.text();
          return HttpResponse.json(
            { id: "1", _links: { self: { href: `${API_URL}/invoices/1` } } },
            { status: 201 },
          );
        }),
      );
      renderForm();

      await fillAndPickFile(user);
      await user.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => expect(body).toBeDefined());
      // jsdom's File isn't undici's, so only the part's type survives the test transport — enough
      // to tell a file part from a stringified value.
      expect(body).toMatch(
        /name="document"; filename="[^"]*"\r\nContent-Type: application\/pdf\r\n/,
      );
      expect(body).toMatch(/name="invoice_number"\r\n\r\nINV-1\r\n/);
    });

    it("omits a removed file from the create request", async () => {
      const user = userEvent.setup();
      let body: FormData | undefined;
      server.use(
        profileRootHandler(),
        invoiceProfileHandler(FILE_CREATE_FORM),
        http.post(`${API_URL}/invoices`, async ({ request }) => {
          body = await request.formData();
          return HttpResponse.json(
            { id: "1", _links: { self: { href: `${API_URL}/invoices/1` } } },
            { status: 201 },
          );
        }),
      );
      renderForm();

      await fillAndPickFile(user);
      await user.click(screen.getByRole("button", { name: /remove file/i }));
      await user.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => expect(body).toBeDefined());
      expect(body!.has("document")).toBe(false);
    });
  });

  describe("initial file from the Create Item page", () => {
    const FILE_CREATE_FORM = {
      method: "POST",
      target: `${API_URL}/invoices`,
      contentType: "multipart/form-data",
      properties: [
        { name: "invoice_number", type: "text", required: true },
        { name: "document", type: "file" },
      ],
    };

    it("prefills the first file field, sends it, and clears it once the item is created", async () => {
      const user = userEvent.setup();
      let body: string | undefined;
      useCreateEntityItemState
        .getState()
        .setInitialFile(new File(["%PDF"], "invoice.pdf", { type: "application/pdf" }));
      server.use(
        profileRootHandler(),
        invoiceProfileHandler(FILE_CREATE_FORM),
        http.post(`${API_URL}/invoices`, async ({ request }) => {
          // Read as text: `request.formData()` rebuilds file parts with the global `File`, which
          // jsdom replaces with one undici's parser rejects.
          body = await request.text();
          return HttpResponse.json(
            { id: "1", _links: { self: { href: `${API_URL}/invoices/1` } } },
            { status: 201 },
          );
        }),
      );
      renderForm();

      await user.type(await screen.findByLabelText(/Invoice Number/), "INV-1");
      await user.click(screen.getByRole("button", { name: "Create" }));

      await vi.waitFor(() => expect(body).toBeDefined());
      expect(body).toMatch(
        /name="document"; filename="[^"]*"\r\nContent-Type: application\/pdf\r\n/,
      );
      await vi.waitFor(() => expect(useCreateEntityItemState.getState().initialFile).toBeNull());
    });

    it("clears the initial file when the user removes it from the form", async () => {
      const user = userEvent.setup();
      useCreateEntityItemState
        .getState()
        .setInitialFile(new File(["%PDF"], "invoice.pdf", { type: "application/pdf" }));
      server.use(profileRootHandler(), invoiceProfileHandler(FILE_CREATE_FORM));
      renderForm();

      await user.click(await screen.findByRole("button", { name: /remove file/i }));

      expect(useCreateEntityItemState.getState().initialFile).toBeNull();
    });

    it("keeps the initial file for a later form when this form has no file field", async () => {
      const initialFile = new File(["%PDF"], "invoice.pdf", { type: "application/pdf" });
      useCreateEntityItemState.getState().setInitialFile(initialFile);
      server.use(profileRootHandler(), invoiceProfileHandler());
      renderForm();

      await screen.findByLabelText(/Invoice Number/);
      expect(useCreateEntityItemState.getState().initialFile).toBe(initialFile);
    });
  });
});
