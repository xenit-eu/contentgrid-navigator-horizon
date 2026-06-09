import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  invoiceProfileBody,
  invoiceProfileTemplates,
  invoiceUpdateTemplate,
  sampleInvoice,
  sampleInvoiceItems,
} from "../hal/fixtures";
import {
  createCreateHandler,
  createDeleteHandler,
  createEntityHandler,
  createListHandler,
  createProblemHandler,
  createProfileHandler,
  createRelationLinkHandler,
  createRelationUnlinkHandler,
  createUpdateHandler,
} from "./handlers";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("createEntityHandler", () => {
  it("returns the configured body as JSON", async () => {
    server.use(
      createEntityHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/1",
        body: sampleInvoice,
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/1");
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ id: "inv-001", number: "INV-2024-001" });
  });

  it("includes _templates when provided", async () => {
    server.use(
      createEntityHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/1",
        body: sampleInvoice,
        templates: { default: invoiceUpdateTemplate },
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/1");
    const body = await res.json();

    expect(body._templates).toBeDefined();
    expect(body._templates.default.method).toBe("PATCH");
  });
});

describe("createListHandler", () => {
  it("returns items embedded under _embedded.item", async () => {
    server.use(
      createListHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices",
        items: sampleInvoiceItems,
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices");
    const body = await res.json();

    expect(body._embedded.item).toHaveLength(3);
    expect(body._embedded.item[0].id).toBe("inv-001");
  });

  it("includes page metadata", async () => {
    server.use(
      createListHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices",
        items: sampleInvoiceItems,
        page: { size: 20, total_items_exact: 3 },
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices");
    const body = await res.json();

    expect(body.page).toEqual({ size: 20, total_items_exact: 3 });
  });

  it("defaults page to items length when omitted", async () => {
    server.use(
      createListHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices",
        items: sampleInvoiceItems,
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices");
    const body = await res.json();

    expect(body.page).toEqual({ size: 3, total_items_exact: 3 });
  });
});

describe("createProfileHandler", () => {
  it("returns profile body with _templates", async () => {
    server.use(
      createProfileHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/profile/invoices",
        body: invoiceProfileBody,
        templates: invoiceProfileTemplates,
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/profile/invoices");
    const body = await res.json();

    expect(body.name).toBe("invoice");
    expect(body._templates).toBeDefined();
    expect(body._templates["create-form"]).toBeDefined();
    expect(body._templates.search).toBeDefined();
  });
});

describe("createCreateHandler", () => {
  it("responds to POST with 201 and Location header", async () => {
    server.use(
      createCreateHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices",
        location: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-new",
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices", {
      method: "POST",
      body: JSON.stringify({ number: "INV-001" }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get("Location")).toBe(
      "https://test-application.eu-west-1.contentgrid.app/invoices/inv-new",
    );
  });

  it("uses a custom status when provided", async () => {
    server.use(
      createCreateHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices",
        location: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-new",
        status: 202,
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices", {
      method: "POST",
    });

    expect(res.status).toBe(202);
  });
});

describe("createUpdateHandler", () => {
  it("responds to PATCH with 204 by default", async () => {
    server.use(
      createUpdateHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1",
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/inv-1", {
      method: "PATCH",
      body: "{}",
    });

    expect(res.status).toBe(204);
  });

  it("returns the configured body and ETag when provided", async () => {
    server.use(
      createUpdateHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1",
        status: 200,
        body: sampleInvoice,
        etag: '"etag-v2"',
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/inv-1", {
      method: "PATCH",
      body: "{}",
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"etag-v2"');
    expect(body.id).toBe("inv-001");
  });
});

describe("createDeleteHandler", () => {
  it("responds to DELETE with 204 by default", async () => {
    server.use(
      createDeleteHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1",
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/inv-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(204);
  });

  it("uses a custom status when provided", async () => {
    server.use(
      createDeleteHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1",
        status: 404,
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/inv-1", {
      method: "DELETE",
    });

    expect(res.status).toBe(404);
  });
});

describe("createRelationLinkHandler", () => {
  it("responds to PUT with 204 by default", async () => {
    server.use(
      createRelationLinkHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
      }),
    );

    const res = await fetch(
      "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
      {
        method: "PUT",
        headers: { "Content-Type": "text/uri-list" },
        body: "https://test-application.eu-west-1.contentgrid.app/customers/cust-1",
      },
    );

    expect(res.status).toBe(204);
  });

  it("uses a custom status when provided", async () => {
    server.use(
      createRelationLinkHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
        status: 409,
      }),
    );

    const res = await fetch(
      "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
      { method: "PUT", body: "" },
    );

    expect(res.status).toBe(409);
  });
});

describe("createRelationUnlinkHandler", () => {
  it("responds to DELETE with 204 by default", async () => {
    server.use(
      createRelationUnlinkHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
      }),
    );

    const res = await fetch(
      "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
      { method: "DELETE" },
    );

    expect(res.status).toBe(204);
  });

  it("uses a custom status when provided", async () => {
    server.use(
      createRelationUnlinkHandler({
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
        status: 404,
      }),
    );

    const res = await fetch(
      "https://test-application.eu-west-1.contentgrid.app/invoices/inv-1/customer",
      { method: "DELETE" },
    );

    expect(res.status).toBe(404);
  });
});

describe("createProblemHandler", () => {
  it("returns application/problem+json body with correct status", async () => {
    server.use(
      createProblemHandler({
        method: "get",
        url: "https://test-application.eu-west-1.contentgrid.app/invoices/missing",
        status: 404,
        title: "Not Found",
        detail: "No invoice with that ID.",
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices/missing");
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("application/problem+json");
    expect(body.status).toBe(404);
    expect(body.title).toBe("Not Found");
    expect(body.detail).toBe("No invoice with that ID.");
  });

  it("works for POST (create conflict 409)", async () => {
    server.use(
      createProblemHandler({
        method: "post",
        url: "https://test-application.eu-west-1.contentgrid.app/invoices",
        status: 409,
        title: "Conflict",
        type: "https://contentgrid.cloud/problems/integrity/duplicate",
      }),
    );

    const res = await fetch("https://test-application.eu-west-1.contentgrid.app/invoices", {
      method: "POST",
      body: "{}",
    });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.type).toBe("https://contentgrid.cloud/problems/integrity/duplicate");
  });
});
