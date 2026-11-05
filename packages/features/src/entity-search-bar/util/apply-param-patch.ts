/**
 * The next complete `filters` map after applying `patch`: a key set to a non-empty string is
 * added or replaced (one value per parameter); a key set to `undefined` or `""` is removed.
 * Keys not in `patch` are kept as they are.
 */
export function applyParamPatch(
  filters: Readonly<Record<string, string>>,
  patch: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  const next: Record<string, string> = { ...filters };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === "") delete next[key];
    else next[key] = value;
  }
  return next;
}
