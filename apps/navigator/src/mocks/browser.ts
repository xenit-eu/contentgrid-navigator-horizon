import { setupWorker } from "msw/browser";
import { createDemoHandlers } from "@contentgrid/navigator-data/test-fixtures/msw/demo-handlers";

export const worker = setupWorker(...createDemoHandlers(window.location.origin));
