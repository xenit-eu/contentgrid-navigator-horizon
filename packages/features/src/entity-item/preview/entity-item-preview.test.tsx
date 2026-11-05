/**
 * Tests for `EntityItemPreview`: which of the two read-only presentations it picks, and that the
 * content one is wired read-only. The panel and selector have their own tests, so they are
 * replaced by probes here that show what they were given.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  type EntityItem,
  EntityItemAttributeContent,
  EntityItemAttributePlain,
  type ProfileAttribute,
  type ProfileEntity,
} from "@contentgrid/navigator-data";
import { EntityItemPreview } from "./entity-item-preview";

vi.mock("../variations/content-focus/components/content-preview-panel", () => ({
  ContentPreviewPanel: (props: {
    attributeName: string;
    readOnly?: boolean;
    toolbarStart?: React.ReactNode;
  }) => (
    <div>
      <div>panel: {props.attributeName}</div>
      <div>read-only: {String(props.readOnly)}</div>
      {props.toolbarStart}
    </div>
  ),
}));
vi.mock("../variations/content-focus/components/content-attribute-selector", () => ({
  ContentAttributeSelector: (props: { value: string; onChange: (name: string) => void }) => (
    <button onClick={() => props.onChange("receipt")}>selector: {props.value}</button>
  ),
}));

const contentAttribute = (name: string, withFile: boolean) => ({
  value: new EntityItemAttributeContent(
    name,
    withFile ? { filename: `${name}.pdf`, mimetype: "application/pdf", length: 1 } : null,
    { href: `https://api.example.com/orders/1/${name}` } as never,
  ),
  profileAttribute: { name, title: name, isContent: true } as unknown as ProfileAttribute,
});

function makeItem(contentAttributes: readonly ReturnType<typeof contentAttribute>[]): EntityItem {
  const nameAttribute = {
    value: new EntityItemAttributePlain("name", "Acme Corp"),
    profileAttribute: {
      name: "name",
      title: "Name",
      isContent: false,
    } as unknown as ProfileAttribute,
  };
  const profileEntity = {
    name: "order",
    attributes: [nameAttribute.profileAttribute],
    userDefinedAttributes: contentAttributes.map((attr) => attr.profileAttribute),
  } as unknown as ProfileEntity;
  return {
    id: "1",
    profileEntity,
    attributes: [nameAttribute, ...contentAttributes],
    userDefinedAttributes: [nameAttribute],
  } as unknown as EntityItem;
}

describe("EntityItemPreview", () => {
  it("shows the content preview, read-only, for an item that holds a file", () => {
    render(
      <EntityItemPreview
        item={makeItem([contentAttribute("document", false), contentAttribute("receipt", true)])}
      />,
    );

    // The default attribute is the first one holding a file.
    expect(screen.getByText("panel: receipt")).toBeInTheDocument();
    expect(screen.getByText("read-only: true")).toBeInTheDocument();
    expect(screen.queryByText("Acme Corp")).not.toBeInTheDocument();
  });

  it("lets the user switch the content attribute", async () => {
    render(
      <EntityItemPreview
        item={makeItem([contentAttribute("document", true), contentAttribute("receipt", true)])}
      />,
    );
    expect(screen.getByText("panel: document")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "selector: document" }));

    expect(screen.getByText("panel: receipt")).toBeInTheDocument();
  });

  it("shows the attributes when no content attribute holds a file", () => {
    render(<EntityItemPreview item={makeItem([contentAttribute("document", false)])} />);

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.queryByText(/^panel:/)).not.toBeInTheDocument();
  });

  it("shows the attributes for an entity without content attributes", () => {
    render(<EntityItemPreview item={makeItem([])} />);

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders no edit, delete or relation controls", () => {
    render(<EntityItemPreview item={makeItem([])} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
