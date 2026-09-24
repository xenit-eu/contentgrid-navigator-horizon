import { describe, expect, it } from "vitest";
import type { SearchTermSuggestionCandidate } from "@contentgrid/navigator-data";
import { applySuggestionBudget } from "./suggestion-budget";

function candidate(
  attributeGroupKey: string,
  value: string,
  propertyName = attributeGroupKey,
): SearchTermSuggestionCandidate {
  return { attributeGroupKey, attributeLabel: attributeGroupKey, propertyName, value };
}

describe("applySuggestionBudget", () => {
  it("returns an empty list for no candidates", () => {
    expect(applySuggestionBudget([])).toEqual([]);
  });

  it("keeps every candidate when the total is under the cap", () => {
    const candidates = [candidate("title", "Acme"), candidate("notes", "Acme note")];
    expect(applySuggestionBudget(candidates, 20)).toHaveLength(2);
  });

  it("splits the budget evenly across groups with an equal number of candidates", () => {
    const candidates = [
      candidate("title", "A1"),
      candidate("title", "A2"),
      candidate("notes", "N1"),
      candidate("notes", "N2"),
    ];
    const result = applySuggestionBudget(candidates, 4);
    expect(result).toHaveLength(4);
  });

  it("caps the total and redistributes a starved group's unused share to a group with more candidates", () => {
    const candidates = [
      candidate("title", "A1"),
      candidate("notes", "N1"),
      candidate("notes", "N2"),
      candidate("notes", "N3"),
      candidate("notes", "N4"),
      candidate("notes", "N5"),
    ];
    const result = applySuggestionBudget(candidates, 4);

    expect(result).toHaveLength(4);
    // "title" only ever had one candidate — its unused share (1 of its even 2-share) must go
    // to "notes" rather than being left on the table.
    expect(result.filter((c) => c.attributeGroupKey === "title")).toHaveLength(1);
    expect(result.filter((c) => c.attributeGroupKey === "notes")).toHaveLength(3);
  });

  it("never exceeds the total cap even with many contributing groups", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => candidate(`attr${i}`, `value${i}`));
    expect(applySuggestionBudget(candidates, 20)).toHaveLength(10);
    expect(applySuggestionBudget(candidates, 5)).toHaveLength(5);
  });

  it("deduplicates a repeated value within the same attribute group before counting it against the budget", () => {
    const candidates = [
      candidate("title", "Acme"),
      candidate("title", "Acme"),
      candidate("title", "Acme Corp"),
    ];
    const result = applySuggestionBudget(candidates, 20);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.value).sort()).toEqual(["Acme", "Acme Corp"]);
  });

  it("produces the same result regardless of the input array's order", () => {
    const candidates = [
      candidate("title", "A1"),
      candidate("notes", "N1"),
      candidate("notes", "N2"),
      candidate("notes", "N3"),
    ];
    const shuffled = [candidates[2], candidates[0], candidates[3], candidates[1]];

    const a = applySuggestionBudget(candidates, 3);
    const b = applySuggestionBudget(shuffled, 3);

    const normalize = (list: readonly SearchTermSuggestionCandidate[]) =>
      list.map((c) => `${c.attributeGroupKey}:${c.value}`).sort();
    expect(normalize(a)).toEqual(normalize(b));
  });
});
