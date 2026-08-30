import { type ReactNode, createContext, useContext } from "react";
import { BooleanAttributeRenderer } from "./boolean-attribute-renderer";
import { ContentAttributeRenderer } from "./content-attribute-renderer";
import { DateAttributeRenderer } from "./date-attribute-renderer";
import { NumberAttributeRenderer } from "./number-attribute-renderer";
import { StringAttributeRenderer } from "./string-attribute-renderer";
import { UnknownAttributeRenderer } from "./unknown-attribute-renderer";

export interface AttributeRendererComponents {
  readonly boolean: typeof BooleanAttributeRenderer;
  readonly string: typeof StringAttributeRenderer;
  readonly number: typeof NumberAttributeRenderer;
  readonly date: typeof DateAttributeRenderer;
  readonly content: typeof ContentAttributeRenderer;
  readonly unknown: typeof UnknownAttributeRenderer;
}

export const defaultAttributeRendererComponents: AttributeRendererComponents = {
  boolean: BooleanAttributeRenderer,
  string: StringAttributeRenderer,
  number: NumberAttributeRenderer,
  date: DateAttributeRenderer,
  content: ContentAttributeRenderer,
  unknown: UnknownAttributeRenderer,
};

const AttributeRendererContext = createContext<AttributeRendererComponents>(
  defaultAttributeRendererComponents,
);

export interface AttributeRendererProviderProps {
  /** Per-type renderer overrides, merged over the built-in defaults. */
  readonly overrides?: Partial<AttributeRendererComponents>;
  readonly children?: ReactNode;
}

/**
 * Lets a consuming app override how one or more attribute types render, without
 * forking the renderers themselves. Wrap this once around the app (or a subtree);
 * without a provider, consumers fall back to `defaultAttributeRendererComponents`.
 */
export function AttributeRendererProvider({
  overrides,
  children,
}: Readonly<AttributeRendererProviderProps>) {
  const value: AttributeRendererComponents = {
    ...defaultAttributeRendererComponents,
    ...overrides,
  };
  return (
    <AttributeRendererContext.Provider value={value}>{children}</AttributeRendererContext.Provider>
  );
}

export function useAttributeRendererComponents(): AttributeRendererComponents {
  return useContext(AttributeRendererContext);
}
