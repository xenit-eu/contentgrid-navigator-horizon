export function isDevTokenMode(): boolean {
  return !!import.meta.env.VITE_DEV_TOKEN;
}

export function getDevToken(): string | null {
  return import.meta.env.VITE_DEV_TOKEN || null;
}
