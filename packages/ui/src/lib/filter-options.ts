/**
 * Client-side prefix filtering for a list of `{ value, label }` options — the allowed values of
 * a constrained field, for example. Shared by `SearchableOptionList` and by callers that build
 * their own suggestion lists from known options, so both narrow a list the same way.
 *
 * Matching is case- and accent-insensitive. An option matches when the query is a prefix of its
 * label, of any word inside its label ("man" matches "Approved by manager"), or of its value.
 * Matches keep their original order, ranked by how they matched: label-prefix matches first,
 * then word-start matches, then value-prefix matches.
 */
export function filterOptionsByPrefix<T extends { readonly label: string; readonly value: string }>(
  options: readonly T[],
  query: string,
  limit?: number,
): T[] {
  const needle = normalize(query.trim());
  const capped = (list: T[]) => (limit === undefined ? list : list.slice(0, limit));
  if (needle === "") return capped([...options]);

  const labelPrefix: T[] = [];
  const wordStart: T[] = [];
  const valuePrefix: T[] = [];
  for (const option of options) {
    const label = normalize(option.label);
    if (label.startsWith(needle)) labelPrefix.push(option);
    else if (label.split(/[\s\-_/.,:;()]+/).some((word) => word.startsWith(needle)))
      wordStart.push(option);
    else if (normalize(option.value).startsWith(needle)) valuePrefix.push(option);
  }
  return capped([...labelPrefix, ...wordStart, ...valuePrefix]);
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}
