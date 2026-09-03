import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AttributeRendererProvider,
  defaultAttributeRendererComponents,
  useAttributeValueRendererComponents,
} from "./registry";

function ComponentsProbe() {
  const components = useAttributeValueRendererComponents();
  return (
    <div>
      <span data-testid="is-default-string">
        {String(components.string === defaultAttributeRendererComponents.string)}
      </span>
      <components.string value="probe value" />
    </div>
  );
}

describe("useAttributeValueRendererComponents", () => {
  it("returns the built-in defaults when used outside a provider", () => {
    render(<ComponentsProbe />);
    expect(screen.getByTestId("is-default-string")).toHaveTextContent("true");
    expect(screen.getByText("probe value")).toBeInTheDocument();
  });
});

describe("AttributeRendererProvider", () => {
  it("merges overrides over the built-in defaults, leaving other renderers untouched", () => {
    function CustomString({ value }: { readonly value: unknown }) {
      return <span>custom:{String(value)}</span>;
    }

    render(
      <AttributeRendererProvider overrides={{ string: CustomString }}>
        <ComponentsProbe />
      </AttributeRendererProvider>,
    );

    expect(screen.getByTestId("is-default-string")).toHaveTextContent("false");
    expect(screen.getByText("custom:probe value")).toBeInTheDocument();
  });

  it("falls back to defaults for renderers not present in overrides", () => {
    function ComponentsBooleanProbe() {
      const components = useAttributeValueRendererComponents();
      return (
        <span data-testid="is-default-boolean">
          {String(components.boolean === defaultAttributeRendererComponents.boolean)}
        </span>
      );
    }

    render(
      <AttributeRendererProvider overrides={{ string: () => <span>unused</span> }}>
        <ComponentsBooleanProbe />
      </AttributeRendererProvider>,
    );

    expect(screen.getByTestId("is-default-boolean")).toHaveTextContent("true");
  });
});
