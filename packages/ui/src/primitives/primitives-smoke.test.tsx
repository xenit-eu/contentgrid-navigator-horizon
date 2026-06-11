/**
 * Render smoke tests for the styled shadcn primitives that are not yet
 * exercised through a pattern-level test. These assert the primitives mount
 * with their data-slot contract and basic content, covering the styling
 * wrappers added for the HZN-5.0 mockup polish.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "./breadcrumb";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardTitleCount,
} from "./card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Pagination,
  PaginationBar,
  PaginationContent,
  PaginationControls,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSummary,
} from "./pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

describe("Pagination", () => {
  it("renders the full pagination bar composition", () => {
    render(
      <PaginationBar>
        <PaginationSummary>Showing 1–20 of 42</PaginationSummary>
        <PaginationControls>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#prev" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#1" isActive>
                  1
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationEllipsis />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#next" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </PaginationControls>
      </PaginationBar>,
    );

    expect(screen.getByText("Showing 1–20 of 42")).toBeInTheDocument();
    // PaginationBar and Pagination each render a labelled <nav>
    expect(screen.getAllByRole("navigation", { name: "pagination" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /previous page/i })).toHaveAttribute("href", "#prev");
    expect(screen.getByRole("link", { name: /next page/i })).toHaveAttribute("href", "#next");
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("More pages")).toBeInTheDocument();
  });
});

describe("Breadcrumb", () => {
  it("renders list, link, separator, ellipsis and current page", () => {
    render(
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/home">Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbEllipsis />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Invoices</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>,
    );

    expect(screen.getByRole("navigation", { name: "breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
    expect(screen.getByText("Invoices")).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("More")).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renders header, title count, action, description, content and footer", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>
            Attributes
            <CardTitleCount>7</CardTitleCount>
          </CardTitle>
          <CardDescription>All attributes</CardDescription>
          <CardAction>
            <button type="button">act</button>
          </CardAction>
        </CardHeader>
        <CardContent>body</CardContent>
        <CardFooter>footer</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Attributes")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("All attributes")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByText("footer")).toBeInTheDocument();
  });
});

describe("Dialog", () => {
  it("opens via the trigger and renders header, body, description and footer", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Open</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm</DialogTitle>
            <DialogDescription>Are you sure?</DialogDescription>
          </DialogHeader>
          <DialogBody>dialog body</DialogBody>
          <DialogFooter>
            <button type="button">OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
    expect(screen.getByText("dialog body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });
});

describe("Select", () => {
  it("opens the listbox and selects an option", async () => {
    const user = userEvent.setup();
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">Option A</SelectItem>
          <SelectItem value="b">Option B</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByText("Pick one")).toBeInTheDocument();
    await user.click(screen.getByRole("combobox"));
    const option = await screen.findByRole("option", { name: "Option A" });
    await user.click(option);
    expect(screen.getByRole("combobox")).toHaveTextContent("Option A");
  });
});

describe("Table", () => {
  it("renders caption, header, body and footer slots", () => {
    render(
      <Table>
        <TableCaption>Demo table</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Row 1</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    expect(screen.getByText("Demo table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(screen.getByText("Row 1")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });
});
