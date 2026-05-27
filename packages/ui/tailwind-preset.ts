// v4 CSS-first preset; TS file kept for ADR-003 filename compatibility and future token exports.
import { fileURLToPath } from "node:url";

export const presetPath = fileURLToPath(
  new URL("./src/styles/preset.css", import.meta.url),
);
