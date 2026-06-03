import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  invoiceProfileBody,
  invoiceProfileTemplates,
  invoiceUpdateTemplate,
  sampleInvoice,
  sampleInvoiceItems,
} from "../hal/fixtures";
import { createEntityHandler, createListHandler, createProfileHandler } from "./handlers";

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
