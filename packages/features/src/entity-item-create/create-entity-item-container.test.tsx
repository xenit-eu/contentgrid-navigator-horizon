import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, within } from "@testing-library/react";
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

  it("clears a stale server error alert when a resubmit is blocked by client-side validation", async () => {
    const user = userEvent.setup();
    server.use(
      profileRootHandler(),
      invoiceProfileHandler(),
      http.post(`${API_URL}/invoices`, () =>
        HttpResponse.json(
          {
            type: "https://contentgrid.cloud/problems/integrity/blind-relation-overwrite",
            title: "Relation already set",
            status: 409,
          },
          { status: 409, headers: { "Content-Type": "application/problem+json" } },
        ),
      ),
    );
    renderForm();

    const input = await screen.findByLabelText(/Invoice Number/);
    await user.type(input, "INV-1");
    await user.click(screen.getByRole("button", { name: "Create" }));
    expect(await screen.findByText("Relation already set")).toBeInTheDocument();

    // Clearing the required field blocks the resubmit client-side, before the mutation ever
    // fires again — the alert from the LAST server round-trip must not linger alongside the new,
    // unrelated client-side "required" error.
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.queryByText("Relation already set")).not.toBeInTheDocument();
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

  describe("file preview", () => {
    const TWO_FILES_CREATE_FORM = {
      method: "POST",
      target: `${API_URL}/invoices`,
      contentType: "multipart/form-data",
      properties: [
        { name: "document", type: "file", prompt: "Document" },
        { name: "attachment", type: "file", prompt: "Attachment" },
      ],
    };

    // A type without a pre-save preview, so the test doesn't load the PDF engine.
    const textFile = () => new File(["notes"], "notes.txt", { type: "text/plain" });

    // The hidden file inputs, in form order; the field labels point at the drop zones instead.
    function fileInput(index: number) {
      return document.querySelectorAll<HTMLInputElement>('input[type="file"]')[index]!;
    }

    function previewFieldSelector(container: HTMLElement) {
      return within(container).getByRole("combobox");
    }

    // The test setup's `matchMedia` stub always reports a narrow screen. This one reports `wide`,
    // and `resize` changes it the way resizing the window would.
    const narrowMatchMedia = window.matchMedia;
    function stubScreen(wide: boolean) {
      let matches = wide;
      type ChangeListener = (event: { matches: boolean }) => void;
      const listeners = new Set<ChangeListener>();
      vi.stubGlobal("matchMedia", (query: string) => ({
        ...narrowMatchMedia(query),
        // A getter, like the browser's: `matches` is read from the same object after a resize.
        get matches() {
          return matches;
        },
        addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
        removeEventListener: (_type: string, listener: ChangeListener) =>
          listeners.delete(listener),
      }));
      return {
        resize(toWide: boolean) {
          matches = toWide;
          act(() => listeners.forEach((listener) => listener({ matches })));
        },
      };
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("switches the preview to the file field the user picks a file in", async () => {
      const user = userEvent.setup();
      stubScreen(true);
      server.use(profileRootHandler(), invoiceProfileHandler(TWO_FILES_CREATE_FORM));
      renderForm();

      const preview = await screen.findByRole("complementary", { name: "File preview" });
      expect(previewFieldSelector(preview)).toHaveTextContent("Document");

      await user.upload(fileInput(1), textFile());

      expect(previewFieldSelector(preview)).toHaveTextContent("Attachment");
      expect(
        within(preview).getByText("Preview isn't available for text/plain files."),
      ).toBeInTheDocument();
    });

    it("shows a PDF that can no longer be read as a file that can't be displayed", async () => {
      const user = userEvent.setup();
      stubScreen(true);
      server.use(profileRootHandler(), invoiceProfileHandler(TWO_FILES_CREATE_FORM));
      renderForm();

      const preview = await screen.findByRole("complementary", { name: "File preview" });
      const unreadablePdf = new File(["%PDF"], "invoice.pdf", { type: "application/pdf" });
      unreadablePdf.arrayBuffer = () => Promise.reject(new Error("The file could not be read."));
      await user.upload(fileInput(0), unreadablePdf);

      expect(await within(preview).findByText("This file can't be displayed.")).toBeInTheDocument();
    });

    it("previews the first file field again after a continuous-create reset", async () => {
      const user = userEvent.setup();
      stubScreen(true);
      server.use(
        profileRootHandler(),
        invoiceProfileHandler(TWO_FILES_CREATE_FORM),
        createdInvoiceHandler(),
      );
      renderForm();

      const preview = await screen.findByRole("complementary", { name: "File preview" });
      await user.click(screen.getByRole("switch", { name: "Keep creating entities" }));
      await user.upload(fileInput(1), textFile());
      expect(previewFieldSelector(preview)).toHaveTextContent("Attachment");

      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(await screen.findByText("Invoice has been successfully created!")).toBeInTheDocument();
      expect(previewFieldSelector(preview)).toHaveTextContent("Document");
    });

    it("switches the preview to the file field the user focuses", async () => {
      const user = userEvent.setup();
      stubScreen(true);
      server.use(profileRootHandler(), invoiceProfileHandler(TWO_FILES_CREATE_FORM));
      renderForm();

      const preview = await screen.findByRole("complementary", { name: "File preview" });
      await user.click(screen.getByLabelText("Attachment"));

      expect(previewFieldSelector(preview)).toHaveTextContent("Attachment");
    });

    it("highlights the previewed one of several file fields", async () => {
      stubScreen(true);
      server.use(profileRootHandler(), invoiceProfileHandler(TWO_FILES_CREATE_FORM));
      renderForm();

      expect(await screen.findByLabelText("Document")).toHaveAttribute("aria-current", "true");
      expect(screen.getByLabelText("Attachment")).not.toHaveAttribute("aria-current");
    });

    it("doesn't highlight a form's only file field", async () => {
      stubScreen(true);
      server.use(
        profileRootHandler(),
        invoiceProfileHandler({
          ...TWO_FILES_CREATE_FORM,
          properties: [{ name: "document", type: "file", prompt: "Document" }],
        }),
      );
      renderForm();

      expect(await screen.findByLabelText("Document")).not.toHaveAttribute("aria-current");
    });

    it("shows a read-only file field's empty preview without a drop zone", async () => {
      stubScreen(true);
      server.use(
        profileRootHandler(),
        invoiceProfileHandler({
          ...TWO_FILES_CREATE_FORM,
          properties: [{ name: "document", type: "file", prompt: "Document", readOnly: true }],
        }),
      );
      renderForm();

      const preview = await screen.findByRole("complementary", { name: "File preview" });
      expect(within(preview).getByText("No file")).toBeInTheDocument();
      expect(within(preview).queryByText(/Drop a file here/)).not.toBeInTheDocument();
    });

    it("opens the preview dialog on the file field whose preview button was clicked", async () => {
      const user = userEvent.setup();
      stubScreen(false);
      server.use(profileRootHandler(), invoiceProfileHandler(TWO_FILES_CREATE_FORM));
      renderForm();

      await screen.findByLabelText("Attachment");
      // On a narrow screen the preview is only in the dialog, not also hidden beside the form.
      expect(screen.queryByRole("complementary", { name: "File preview" })).not.toBeInTheDocument();
      await user.upload(fileInput(1), textFile());
      await user.click(screen.getByRole("button", { name: "Preview file" }));

      const dialog = screen.getByRole("dialog", { name: "Preview file" });
      expect(previewFieldSelector(dialog)).toHaveTextContent("Attachment");
      expect(
        within(dialog).getByText("Preview isn't available for text/plain files."),
      ).toBeInTheDocument();
    });

    it("closes the preview dialog when the window widens, and doesn't reopen it on narrowing", async () => {
      const user = userEvent.setup();
      const screenWidth = stubScreen(false);
      server.use(profileRootHandler(), invoiceProfileHandler(TWO_FILES_CREATE_FORM));
      renderForm();

      await screen.findByLabelText("Attachment");
      await user.upload(fileInput(1), textFile());
      await user.click(screen.getByRole("button", { name: "Preview file" }));
      expect(screen.getByRole("dialog", { name: "Preview file" })).toBeInTheDocument();

      screenWidth.resize(true);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByRole("complementary", { name: "File preview" })).toBeInTheDocument();

      screenWidth.resize(false);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
