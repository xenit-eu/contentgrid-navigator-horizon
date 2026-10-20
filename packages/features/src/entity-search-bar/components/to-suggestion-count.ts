import type { SuggestionCount } from "@contentgrid/ui";
import type { CountState } from "../util/types";

/** A count model as the popover's count chip shows it: "?" whenever no number is known. */
export function toSuggestionCount(count: CountState): SuggestionCount {
  switch (count.status) {
    case "known":
      return { count: count.count, isEstimated: count.isEstimated };
    case "loading":
      return { count: null, isLoading: true };
    default:
      return { count: null };
  }
}
