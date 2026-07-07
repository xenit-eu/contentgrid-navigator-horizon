import { describe, expect, it, vi } from "vitest";
import { bestEffortPrefetch } from "./best-effort-prefetch";

describe("bestEffortPrefetch", () => {
  it("resolves normally when the work succeeds", async () => {
    const work = vi.fn().mockResolvedValue("ignored");
    await expect(bestEffortPrefetch(work)).resolves.toBeUndefined();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("swallows a rejection instead of propagating it", async () => {
    const work = vi.fn().mockRejectedValue(new Error("401 Unauthorized"));
    await expect(bestEffortPrefetch(work)).resolves.toBeUndefined();
  });

  it("swallows a synchronous throw inside the work callback", async () => {
    const work = vi.fn().mockImplementation(() => {
      throw new Error("boom");
    });
    await expect(bestEffortPrefetch(work)).resolves.toBeUndefined();
  });
});
