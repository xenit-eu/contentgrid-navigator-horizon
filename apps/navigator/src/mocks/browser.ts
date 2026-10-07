import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";

// `VITE_MOCK_USER=restricted` serves the recorded restricted user (see test-fixtures/recorded/README.md).
const mockUser = import.meta.env.VITE_MOCK_USER === "restricted" ? "restricted" : "full";

export const worker = setupWorker(
  ...createDemoHandlers(window.location.origin, { user: mockUser }),
);
