import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ContentGridProblemType,
  ProblemDetailError,
  type UnsatisfiedVersionProblem,
} from "@contentgrid/navigator-data";
import { notifyProblem } from "./notify-problem";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

type CapturedToastOptions = {
  readonly description?: string;
  readonly action?: { readonly label: string; readonly onClick: () => void };
};

function lastToast() {
  const [message, options] = vi.mocked(toast.error).mock.calls[0];
  return { message, ...(options as CapturedToastOptions) };
}

const versionConflict = new ProblemDetailError<UnsatisfiedVersionProblem>({
  type: ContentGridProblemType.UNSATISFIED_VERSION,
  status: 412,
  title: "Version conflict",
  detail: "This item was changed by someone else.",
  actual_version: 'W/"2"',
});

const requiredRelation = new ProblemDetailError({
  type: ContentGridProblemType.INTEGRITY_REQUIRED_RELATION,
  status: 409,
  title: "Required relation",
  detail: "Another item still refers to this one.",
});

describe("notifyProblem", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("offers a Reload action for a 412 that calls onRefresh", () => {
    const onRefresh = vi.fn();

    notifyProblem(versionConflict, onRefresh);

    const { message, description, action } = lastToast();
    expect(message).toBe("Version conflict");
    expect(description).toBe("This item was changed by someone else.");
    expect(action?.label).toBe("Reload");
    action?.onClick();
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it("shows any other problem without a Reload action", () => {
    notifyProblem(requiredRelation, vi.fn());

    const { message, description, action } = lastToast();
    expect(message).toBe("Required relation");
    expect(description).toBe("Another item still refers to this one.");
    expect(action).toBeUndefined();
  });
});
