import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Unmount React trees between tests. Vitest runs without `globals: true`,
// so RTL's auto-cleanup never registers; without this, mounted trees leak
// across tests and keep React's scheduler running after jsdom teardown.
afterEach(() => {
  cleanup();
});
