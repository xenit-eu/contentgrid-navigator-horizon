import { toast } from "sonner";
import { describe, expect, it, vi } from "vitest";
import { ContentGridProblemType, ProblemDetailError } from "@contentgrid/navigator-data";
import { notifyProblem } from "./notify-problem";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

describe("notifyProblem", () => {
  it("shows the problem's title as the message and its detail as the description", () => {
    const requiredRelation = new ProblemDetailError({
      type: ContentGridProblemType.INTEGRITY_REQUIRED_RELATION,
      status: 409,
      title: "Required relation",
      detail: "Another item still refers to this one.",
    });

    notifyProblem(requiredRelation);

    expect(toast.error).toHaveBeenCalledWith("Required relation", {
      description: "Another item still refers to this one.",
    });
  });
});
