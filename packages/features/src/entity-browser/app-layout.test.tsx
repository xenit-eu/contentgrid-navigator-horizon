import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { server } from "../../test-setup";
import {
  emptyInvoicesList,
  invoiceProfileHandler,
  profileRootHandler,
  renderEntityList,
} from "./test-support";

describe("EntityListLayout", () => {
  it("shows sidebar with entity section heading", async () => {
    server.use(profileRootHandler(), invoiceProfileHandler(), emptyInvoicesList);

    renderEntityList();

    expect(await screen.findByText("Entities")).toBeInTheDocument();
  });
});
