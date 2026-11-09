/**
 * Tests for `ContentAttributeSelector`: nothing for zero content attributes, a disabled selector
 * that still shows the sole attribute for context (round-2 review of #192) for exactly one, and
 * the normal enabled selector for two or more.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  type EntityItem,
  EntityItemAttributeContent,
  type ProfileAttribute,
} from "@contentgrid/navigator-data";
import { ContentAttributeSelector } from "./content-attribute-selector";

function makeProfileAttribute(name: string, title: string): ProfileAttribute {
  return { name, title, isContent: true } as unknown as ProfileAttribute;
}

function makeContentAttribute(name: string, title: string) {
  return {
    value: new EntityItemAttributeContent(name, null, {
      href: `https://api.example.com/orders/1/${name}`,
    } as never),
    profileAttribute: makeProfileAttribute(name, title),
  };
}

function makeEntityItem(attrs: readonly ReturnType<typeof makeContentAttribute>[]): EntityItem {
  return { attributes: attrs } as unknown as EntityItem;
}

describe("ContentAttributeSelector", () => {
  it("renders nothing when the item has no content attributes", () => {
    const entityItem = makeEntityItem([]);
    const { container } = render(
      <ContentAttributeSelector entityItem={entityItem} value="" onChange={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a disabled selector showing the sole content attribute, for context, instead of nothing", () => {
    const entityItem = makeEntityItem([makeContentAttribute("document", "Order document")]);
    render(
      <ContentAttributeSelector entityItem={entityItem} value="document" onChange={vi.fn()} />,
    );

    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent("Order document");
  });

  it("renders an enabled selector when the item has two or more content attributes", () => {
    const entityItem = makeEntityItem([
      makeContentAttribute("document", "Order document"),
      makeContentAttribute("receipt", "Receipt"),
    ]);
    render(
      <ContentAttributeSelector entityItem={entityItem} value="document" onChange={vi.fn()} />,
    );

    expect(screen.getByRole("combobox")).not.toBeDisabled();
  });

  it("fires onChange with the newly selected attribute's name", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const entityItem = makeEntityItem([
      makeContentAttribute("document", "Order document"),
      makeContentAttribute("receipt", "Receipt"),
    ]);
    render(
      <ContentAttributeSelector entityItem={entityItem} value="document" onChange={onChange} />,
    );

    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByRole("option", { name: /Receipt/ }));

    expect(onChange).toHaveBeenCalledWith("receipt");
  });
});
