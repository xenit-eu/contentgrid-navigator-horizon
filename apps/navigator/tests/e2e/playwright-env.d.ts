// Minimal Node.js type shims for the Playwright test layer.
// Avoids a hard dependency on @types/node — Playwright provides its own
// type augmentations; we only need process.env and readFileSync.
declare const process: {
  env: Record<string, string | undefined>;
};

declare module "node:fs" {
  export function readFileSync(path: string | URL, encoding: "utf-8"): string;
}
