import { describe, expect, it } from "vitest";
import { AppShell, CollectionListView, HomeView, ItemDetailView, getEntityVisuals } from "./index";

describe("entity-browser barrel", () => {
  it("exposes the public entity-browser API", () => {
    expect(AppShell).toBeTypeOf("function");
    expect(CollectionListView).toBeTypeOf("function");
    expect(HomeView).toBeTypeOf("function");
    expect(ItemDetailView).toBeTypeOf("function");
    expect(getEntityVisuals).toBeTypeOf("function");
  });
});
