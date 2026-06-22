import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog", () => {
  it("renders trigger button", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
      </Dialog>,
    );
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders dialog content with title and description when open", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test title</DialogTitle>
            <DialogDescription>Test description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText("Test title")).toBeInTheDocument();
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("renders the Phosphor X close icon (svg) in dialog content", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    // DialogContent renders into a portal, so query document.body
    expect(document.body.querySelector("svg")).toBeInTheDocument();
  });

  it("does not render close icon when showCloseButton=false", () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Title</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(document.body.querySelector("svg")).not.toBeInTheDocument();
  });
});
