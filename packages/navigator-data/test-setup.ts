import "@testing-library/jest-dom/vitest";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

// Shared MSW server for navigator-data tests. HAL response handlers are
// registered per-test (or via a shared handlers module in HZN-2.4).
export const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
